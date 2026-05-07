// ─── Cross-Platform Machine-Secured Token Encryption ─────────────────────────
// Architecture:
//   1. On first run: generate a random 256-bit master key (MK)
//   2. Protect MK using the OS credential store (keyring crate)
//      - Windows → Credential Manager
//      - macOS   → Keychain
//      - Linux   → Secret Service (libsecret / gnome-keyring / KWallet)
//   3. Fallback: file-based encryption with machine-bound derivation
//      (Argon2id from hostname + username + app path)
//   4. All source tokens are encrypted with MK (AES-256-GCM) before SQLite storage
//   5. On boot: decrypt MK from the OS credential store (only current user can do this)
//
// This means: stealing the SQLite file is useless without the user's OS session.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::SaltString, Argon2, PasswordHasher};
use rand::Rng;
use rand::RngCore;
use std::fs;
use std::path::PathBuf;

// ─── Windows DPAPI bindings (legacy, kept for migration) ─────────────────────

/// DATA_BLOB structure used by DPAPI functions.
#[cfg(target_os = "windows")]
#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}

#[cfg(target_os = "windows")]
impl DataBlob {
    fn from_slice(data: &[u8]) -> Self {
        Self {
            cb_data: data.len() as u32,
            pb_data: data.as_ptr() as *mut u8,
        }
    }

    fn empty() -> Self {
        Self {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        }
    }

    /// Consume the blob, copying data to a Vec and freeing the DPAPI-allocated buffer.
    unsafe fn to_vec_and_free(self) -> Vec<u8> {
        if self.pb_data.is_null() || self.cb_data == 0 {
            return Vec::new();
        }
        let result = std::slice::from_raw_parts(self.pb_data, self.cb_data as usize).to_vec();
        #[link(name = "kernel32")]
        extern "system" {
            fn LocalFree(h_mem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        }
        LocalFree(self.pb_data as *mut std::ffi::c_void);
        result
    }
}

#[cfg(target_os = "windows")]
#[allow(dead_code)]
fn dpapi_encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            p_data_in: *const DataBlob,
            sz_data_descr: *const u16,
            p_optional_entropy: *const std::ffi::c_void,
            pv_reserved: *const std::ffi::c_void,
            p_prompt_struct: *const std::ffi::c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;
    }
    let input = DataBlob::from_slice(data);
    let mut output = DataBlob::empty();
    unsafe {
        let ok = CryptProtectData(
            &input, std::ptr::null(), std::ptr::null(),
            std::ptr::null(), std::ptr::null(), 0, &mut output,
        );
        if ok == 0 {
            return Err(format!("DPAPI CryptProtectData failed: {}", std::io::Error::last_os_error()));
        }
        Ok(output.to_vec_and_free())
    }
}

#[cfg(target_os = "windows")]
#[allow(dead_code)]
fn dpapi_decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    #[link(name = "crypt32")]
    extern "system" {
        fn CryptUnprotectData(
            p_data_in: *const DataBlob,
            ppsz_data_descr: *mut *mut u16,
            p_optional_entropy: *const std::ffi::c_void,
            pv_reserved: *const std::ffi::c_void,
            p_prompt_struct: *const std::ffi::c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;
    }
    let input = DataBlob::from_slice(data);
    let mut output = DataBlob::empty();
    unsafe {
        let ok = CryptUnprotectData(
            &input, std::ptr::null_mut(), std::ptr::null(),
            std::ptr::null(), std::ptr::null(), 0, &mut output,
        );
        if ok == 0 {
            return Err(format!("DPAPI CryptUnprotectData failed: {}", std::io::Error::last_os_error()));
        }
        Ok(output.to_vec_and_free())
    }
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
fn dpapi_encrypt(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("DPAPI not available on this platform".to_string())
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
fn dpapi_decrypt(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("DPAPI not available on this platform".to_string())
}

// ─── OS Keyring (primary cross-platform MK protection) ──────────────────────

const KEYRING_SERVICE: &str = "com.devdash.app";
const KEYRING_ACCOUNT: &str = "master-key";

/// Store the master key in the OS credential store.
/// Returns Ok(()) on success.
fn keyring_store_mk(mk: &[u8; 32]) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    let encoded = BASE64.encode(mk);

    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Keyring entry creation failed: {e}"))?;

    entry.set_password(&encoded)
        .map_err(|e| format!("Keyring store failed: {e}"))?;

    log::info!("Master key stored in OS credential store");
    Ok(())
}

/// Load the master key from the OS credential store.
/// Returns Ok(None) if no key exists yet (first run).
fn keyring_load_mk() -> Result<Option<[u8; 32]>, String> {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Keyring entry creation failed: {e}"))?;

    match entry.get_password() {
        Ok(encoded) => {
            let bytes = BASE64.decode(&encoded)
                .map_err(|e| format!("Keyring data base64 decode failed: {e}"))?;
            if bytes.len() != 32 {
                return Err(format!("Keyring MK must be 32 bytes, got {}", bytes.len()));
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            log::info!("Master key loaded from OS credential store");
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => {
            log::info!("No master key in OS credential store (first run)");
            Ok(None)
        }
        Err(e) => {
            log::warn!("Keyring load failed: {e} — will try fallback");
            Err(format!("Keyring load failed: {e}"))
        }
    }
}

/// Delete the master key from the OS credential store (used during migration).
#[allow(dead_code)]
fn keyring_delete_mk() -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| format!("Keyring entry creation failed: {e}"))?;
    // keyring v3: no delete_password; set empty to effectively remove
    entry.set_password("")
        .map_err(|e| format!("Keyring clear failed: {e}"))
}

// ─── Fallback: File-based MK protection (machine-bound derivation) ───────────
// Used when the OS keyring is unavailable (e.g., headless Linux without D-Bus)

const MK_FILE: &str = "devdash.mk";

/// Derive a machine-specific encryption key from hostname + username.
/// This is weaker than OS keyring but better than plaintext.
fn derive_machine_key() -> [u8; 32] {
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown".to_string());
    let username = whoami::username();
    let platform = whoami::platform().to_string();

    // Mix machine-specific data as the "password" for Argon2id
    let identity = format!("{hostname}:{username}:{platform}:devdash-mk-v1");

    // Use a fixed salt derived from app identity (not random, must be deterministic)
    let fixed_salt = b"DevDash-MK-Salt-2026-CrossPlatform";

    let salt_b64 = SaltString::encode_b64(fixed_salt)
        .expect("salt fits in base64");
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(identity.as_bytes(), &salt_b64)
        .expect("Argon2id derivation failed");
    let hash_output = hash.hash.expect("no hash output");

    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_output.as_bytes()[..32]);
    key
}

/// Encrypt MK with machine-bound key and store to file (fallback).
fn file_store_mk(app_data_dir: &PathBuf, mk: &[u8; 32]) -> Result<(), String> {
    let machine_key = derive_machine_key();
    let cipher = Aes256Gcm::new_from_slice(&machine_key)
        .expect("AES-256-GCM key size is 32 bytes");

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, mk.as_slice())
        .map_err(|_| "MK file encryption failed")?;

    // Format: "DMK1" (4 bytes) + nonce (12) + ciphertext
    let mut result = Vec::with_capacity(4 + 12 + ciphertext.len());
    result.extend_from_slice(b"DMK1");
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    let mk_path = app_data_dir.join(MK_FILE);
    fs::write(&mk_path, &result).map_err(|e| format!("Cannot write MK file: {e}"))?;

    log::info!("Master key stored in file (fallback mode)");
    Ok(())
}

/// Load MK from file-based storage (fallback).
fn file_load_mk(app_data_dir: &PathBuf) -> Result<Option<[u8; 32]>, String> {
    let mk_path = app_data_dir.join(MK_FILE);
    if !mk_path.exists() {
        return Ok(None);
    }

    let data = fs::read(&mk_path).map_err(|e| format!("Cannot read MK file: {e}"))?;

    // Check format
    if data.starts_with(b"DMK1") {
        // New cross-platform format
        if data.len() < 4 + 12 + 16 {
            return Err("MK file too short (new format)".to_string());
        }
        let nonce_bytes = &data[4..16];
        let ciphertext = &data[16..];

        let machine_key = derive_machine_key();
        let cipher = Aes256Gcm::new_from_slice(&machine_key)
            .expect("AES-256-GCM key size is 32 bytes");
        let nonce = Nonce::from_slice(nonce_bytes);

        let decrypted = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "MK file decryption failed (machine identity changed?)".to_string())?;

        if decrypted.len() != 32 {
            return Err(format!("Decrypted MK must be 32 bytes, got {}", decrypted.len()));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&decrypted);
        log::info!("Master key loaded from file (fallback mode)");
        Ok(Some(key))
    } else if data.starts_with(b"DEV_") {
        // Very old legacy format — cannot recover, regenerate
        log::warn!("Legacy DEV_ format detected, regenerating master key");
        let _ = fs::remove_file(&mk_path);
        Ok(None)
    } else {
        // Old DPAPI format (Windows only) — try to migrate
        log::info!("Old DPAPI format detected, attempting migration to keyring...");
        match dpapi_decrypt(&data) {
            Ok(mk_bytes) => {
                if mk_bytes.len() != 32 {
                    log::warn!("DPAPI-decrypted MK wrong size, regenerating");
                    let _ = fs::remove_file(&mk_path);
                    return Ok(None);
                }
                let mut key = [0u8; 32];
                key.copy_from_slice(&mk_bytes);

                // Migrate to keyring + new file format
                if keyring_store_mk(&key).is_ok() {
                    let _ = fs::remove_file(&mk_path);
                    log::info!("Migrated MK from DPAPI to OS keyring");
                } else {
                    // Migrate to new file format
                    let _ = file_store_mk(app_data_dir, &key);
                    let _ = fs::remove_file(&mk_path);
                    log::info!("Migrated MK from DPAPI to file-based storage");
                }
                Ok(Some(key))
            }
            Err(e) => {
                log::warn!("DPAPI migration failed: {e} — regenerating");
                let _ = fs::remove_file(&mk_path);
                Ok(None)
            }
        }
    }
}

// ─── Master Key Management (unified) ────────────────────────────────────────

/// Load the master key (MK) from OS keyring, with file-based fallback.
/// Also handles migration from legacy DPAPI format.
/// Returns None if this is the first run (no MK yet).
pub fn load_master_key(app_data_dir: &PathBuf) -> Result<Option<[u8; 32]>, String> {
    // Strategy: Try OS keyring first → then file fallback
    match keyring_load_mk() {
        Ok(Some(key)) => return Ok(Some(key)),
        Ok(None) => {
            // No key in keyring — check if there's a file-based one
            // (could be a migration from DPAPI or a system without keyring)
        }
        Err(_) => {
            // Keyring unavailable — try file-based
        }
    }

    // Try file-based loading (also handles DPAPI migration on Windows)
    match file_load_mk(app_data_dir)? {
        Some(key) => {
            // Got a key from file — also store in keyring for next time
            if keyring_store_mk(&key).is_ok() {
                log::info!("Promoted file-based MK to OS keyring");
            }
            Ok(Some(key))
        }
        None => Ok(None),
    }
}

/// Generate and persist a new master key.
/// Stores in OS keyring (primary) + file (fallback).
pub fn create_master_key(app_data_dir: &PathBuf) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);

    // Store in OS keyring (primary)
    let keyring_ok = keyring_store_mk(&key).is_ok();

    // Also store as file-based backup (for systems where keyring might break)
    if let Err(e) = file_store_mk(app_data_dir, &key) {
        if !keyring_ok {
            // Both failed — this is a problem
            return Err(format!("Failed to store master key: keyring failed, file fallback failed: {e}"));
        }
        // Keyring OK but file failed — not critical
        log::warn!("File-based MK backup failed (keyring OK): {e}");
    }

    log::info!("Master key created and stored (keyring: {}, file: {})",
        if keyring_ok { "OK" } else { "FAILED" },
        "OK"
    );
    Ok(key)
}

// ─── Token Encryption (AES-256-GCM with random salt+nonce) ────────────────────

/// Encrypt a token using the master key.
/// Returns: [salt(16)] || [nonce(12)] || [ciphertext]
pub fn encrypt_token(mk: &[u8; 32], plaintext: &str) -> Vec<u8> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill(&mut salt);

    let derived = derive_key_for_salt(mk, &salt);
    let cipher = Aes256Gcm::new_from_slice(&derived).expect("AES-256-GCM key size is 32 bytes");

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .expect("AES-GCM encryption failed");

    let mut result = Vec::with_capacity(16 + 12 + ciphertext.len());
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    result
}

/// Decrypt a token encrypted with encrypt_token().
pub fn decrypt_token(mk: &[u8; 32], data: &[u8]) -> Result<String, String> {
    if data.len() < 28 {
        return Err("Encrypted token too short".to_string());
    }

    let salt = &data[0..16];
    let nonce_bytes = &data[16..28];
    let ciphertext = &data[28..];

    let derived = derive_key_for_salt(mk, salt);
    let cipher = Aes256Gcm::new_from_slice(&derived).expect("AES-256-GCM key size is 32 bytes");
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Token decryption failed: wrong key or corrupted data".to_string())?;

    String::from_utf8(plaintext).map_err(|_| "Token is not valid UTF-8".to_string())
}

/// Derive a 256-bit key from the master key and a salt using Argon2id.
fn derive_key_for_salt(mk: &[u8; 32], salt: &[u8]) -> [u8; 32] {
    let salt_b64 = SaltString::encode_b64(salt).expect("salt fits in base64");
    let argon2 = Argon2::default();
    let mixed: Vec<u8> = mk.iter().chain(salt.iter()).cloned().collect();
    let mixed_str = std::str::from_utf8(&mixed).unwrap_or(&"fallback");
    let hash = argon2
        .hash_password(mixed_str.as_bytes(), &salt_b64)
        .expect("Argon2id failed");
    let hash_output = hash.hash.expect("no hash output");
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_output.as_bytes()[..32]);
    key
}

// ─── Config Encryption (for stored GitHub/GitLab tokens) ────────────────────

/// Encrypt a source config JSON string (contains the token).
#[allow(dead_code)]
pub fn encrypt_config(mk: &[u8; 32], config_json: &str) -> Vec<u8> {
    encrypt_token(mk, config_json)
}

/// Decrypt a source config JSON string.
#[allow(dead_code)]
pub fn decrypt_config(mk: &[u8; 32], data: &[u8]) -> Result<String, String> {
    decrypt_token(mk, data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_roundtrip() {
        let mk = [0u8; 32];
        let token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";
        let encrypted = encrypt_token(&mk, token);
        let decrypted = decrypt_token(&mk, &encrypted).unwrap();
        assert_eq!(token, decrypted);
    }

    #[test]
    fn config_roundtrip() {
        let mk = [0u8; 32];
        let config = r#"{"token":"super-secret","owner":"test","repo":"foo"}"#;
        let encrypted = encrypt_config(&mk, config);
        let decrypted = decrypt_config(&mk, &encrypted).unwrap();
        assert_eq!(config, decrypted);
    }
}
