// -*- coding: utf-8 -*-
import React, { useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  GitBranch,
  GitMerge,
  Sparkles,
  Rocket,
  Settings2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { useSettingsStore } from "../../stores/settingsStore";
import { apiTestAiConnection, apiVerifyGithubToken } from "../../lib/api";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = "welcome" | "source" | "ai" | "done";

const STEPS: { key: Step; title: string; titleEn: string }[] = [
  { key: "welcome", title: "欢迎使用", titleEn: "Welcome" },
  { key: "source", title: "添加数据源", titleEn: "Add Data Source" },
  { key: "ai", title: "AI 配置", titleEn: "AI Setup" },
  { key: "done", title: "开始使用", titleEn: "Get Started" },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [sourceType, setSourceType] = useState<"github" | "gitlab">("github");
  const [token, setToken] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [testingSource, setTestingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourceSuccess, setSourceSuccess] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<"ollama" | "openai" | "skip">("ollama");
  const [aiBaseUrl, setAiBaseUrl] = useState("http://localhost:11434");
  const [aiApiKey, setAiApiKey] = useState("");
  const [testingAi, setTestingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].key);
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].key);
    }
  };

  const handleTestAndSaveSource = async () => {
    if (!token.trim()) {
      setSourceError("请输入 Token / Please enter token");
      return;
    }

    setTestingSource(true);
    setSourceError(null);
    setSourceSuccess(null);

    // Step 1: Verify token (GitHub only for now)
    if (sourceType === "github") {
      try {
        const verifyResult = await apiVerifyGithubToken(token.trim());
        setSourceSuccess(`已连接 @${verifyResult.login} · ${verifyResult.public_repos} 个公开仓库`);
      } catch (e: any) {
        const msg = e?.message || String(e);
        // Strip Tauri prefix if present
        const cleanMsg = msg.replace(/^Invoke Error: \(error: "", message: "|"\)$/g, "");
        setSourceError(`Token 验证失败：${cleanMsg}`);
        setTestingSource(false);
        return;
      }
    }

    try {
      const sourceInput = {
        pluginId: "@devdash/core",
        type: sourceType,
        label: sourceType === "github" ? "GitHub" : "GitLab",
        config: {
          token: token.trim(),
          ...(sourceType === "github" ? {
            owner: repoOwner.trim() || undefined,
            repo: repoName.trim() || undefined,
            all_repos: !repoOwner.trim() && !repoName.trim() ? true : undefined,
          } : {
            base_url: "https://gitlab.com",
          }),
        },
        enabled: true,
      };

      await useSettingsStore.getState().addSource(sourceInput);
      handleNext();
    } catch (e: any) {
      setSourceError(e?.message || "保存失败 / Save failed");
    } finally {
      setTestingSource(false);
    }
  };

  const handleTestAndSaveAi = async () => {
    if (aiProvider === "skip") {
      handleNext();
      return;
    }

    if (!aiBaseUrl.trim()) {
      setAiError("请输入 Base URL / Please enter base URL");
      return;
    }

    setTestingAi(true);
    setAiError(null);

    try {
      // Test connection
      await apiTestAiConnection(aiProvider, aiBaseUrl.trim(), aiApiKey.trim() || undefined);
      
      // Save AI settings
      useSettingsStore.getState().updateSettings({
        ai: {
          provider: aiProvider,
          enabled: true,
          baseUrl: aiBaseUrl.trim(),
          apiKey: aiApiKey.trim() || undefined,
        },
      });
      handleNext();
    } catch (e: any) {
      setAiError(e?.message || "测试失败 / Test failed");
    } finally {
      setTestingAi(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              i <= currentStepIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {i < currentStepIndex ? <Check className="w-4 h-4" /> : i + 1}
            <span className="hidden sm:inline">{s.title}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Rocket className="w-10 h-10 text-primary-foreground" />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">欢迎使用 DevDash</h1>
        <p className="text-muted-foreground">Your Developer Morning Companion</p>
      </div>
      <div className="space-y-3 text-left max-w-md mx-auto">
        <p className="text-sm text-muted-foreground">
          DevDash 是开发者的晨间伴侣，帮助你在打开 IDE 之前快速了解项目状态：
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>查看 GitHub/GitLab PRs、Issues、CI 状态</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>AI 摘要帮你快速了解关键更新</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span>桌面小组件，随时可见</span>
          </li>
        </ul>
      </div>
      <p className="text-sm text-muted-foreground">
        让我们开始配置你的第一个数据源吧！
      </p>
    </div>
  );

  const renderSource = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">添加数据源</h2>
        <p className="text-muted-foreground">连接 GitHub 或 GitLab 获取项目数据</p>
      </div>

      {/* Source Type Selection */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => setSourceType("github")}
          className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
            sourceType === "github"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/50"
          }`}
        >
          <GitBranch className="w-6 h-6" />
          <span className="font-medium">GitHub</span>
        </button>
        <button
          onClick={() => setSourceType("gitlab")}
          className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
            sourceType === "gitlab"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/50"
          }`}
        >
          <GitMerge className="w-6 h-6" />
          <span className="font-medium">GitLab</span>
        </button>
      </div>

      {/* Token Input */}
      <div className="space-y-4 max-w-md mx-auto">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Token <span className="text-destructive">*</span>
          </label>
          <Input
            type="password"
            placeholder={sourceType === "github" ? "ghp_xxxx..." : "glpat-xxxx..."}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {sourceType === "github" ? (
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                在 GitHub 创建 Token →
              </a>
            ) : (
              <a
                href="https://gitlab.com/-/user_settings/personal_access_tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                在 GitLab 创建 Token →
              </a>
            )}
          </p>
        </div>

        {/* Optional: Specific Repo */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            ▸ 指定仓库（可选，留空则监控所有可访问仓库）
          </summary>
          <div className="mt-3 space-y-3 pl-2">
            <Input
              placeholder="仓库所有者 / Owner (e.g. tauri-apps)"
              value={repoOwner}
              onChange={(e) => setRepoOwner(e.target.value)}
            />
            <Input
              placeholder="仓库名称 / Repo name (e.g. tauri)"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              不填 owner/repo 则自动监控 Token 可访问的所有仓库
            </p>
          </div>
        </details>

        {sourceSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-sm text-green-500">{sourceSuccess}</span>
          </div>
        )}
        {sourceError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <X className="w-4 h-4" />
            {sourceError}
          </p>
        )}
      </div>
    </div>
  );

  const renderAi = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">AI 配置</h2>
        <p className="text-muted-foreground">配置 AI 帮助你快速了解项目更新</p>
      </div>

      <div className="grid gap-4 max-w-lg mx-auto">
        {/* Ollama Option */}
        <button
          onClick={() => setAiProvider("ollama")}
          className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            aiProvider === "ollama"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/50"
          }`}
        >
          <Sparkles className="w-8 h-8 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Ollama（本地）</h3>
            <p className="text-sm text-muted-foreground">
              免费本地运行，隐私优先
            </p>
          </div>
        </button>

        {/* OpenAI Option */}
        <button
          onClick={() => setAiProvider("openai")}
          className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            aiProvider === "openai"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/50"
          }`}
        >
          <Settings2 className="w-8 h-8 text-muted-foreground" />
          <div>
            <h3 className="font-medium">OpenAI / 其他</h3>
            <p className="text-sm text-muted-foreground">
              云端 AI，更强大的摘要能力
            </p>
          </div>
        </button>

        {/* Skip Option */}
        <button
          onClick={() => setAiProvider("skip")}
          className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            aiProvider === "skip"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/50"
          }`}
        >
          <X className="w-8 h-8 text-muted-foreground" />
          <div>
            <h3 className="font-medium">稍后配置</h3>
            <p className="text-sm text-muted-foreground">
              可以稍后在设置中配置
            </p>
          </div>
        </button>
      </div>

      {/* Provider-specific config */}
      {aiProvider !== "skip" && (
        <div className="max-w-md mx-auto space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Base URL</label>
            <Input
              placeholder={aiProvider === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1"}
              value={aiBaseUrl}
              onChange={(e) => setAiBaseUrl(e.target.value)}
            />
          </div>
          {aiProvider !== "ollama" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </div>
          )}
          {aiError && (
            <p className="text-sm text-destructive">{aiError}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderDone = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="w-10 h-10 text-green-500" />
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold mb-2">配置完成！</h1>
        <p className="text-muted-foreground">You're all set!</p>
      </div>
      <p className="text-sm text-muted-foreground max-w-md">
        现在你可以开始使用 DevDash 了。数据会自动刷新，你也可以点击刷新按钮手动更新。
      </p>
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-left max-w-md mx-auto">
        <p className="font-medium mb-2">💡 小提示：</p>
        <ul className="space-y-1 text-muted-foreground">
          <li>• 点击侧边栏的「添加组件」添加更多 Widget</li>
          <li>• 拖拽 Widget 可以重新排列位置</li>
          <li>• 设置中可以添加更多数据源或配置 AI</li>
        </ul>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case "welcome":
        return renderWelcome();
      case "source":
        return renderSource();
      case "ai":
        return renderAi();
      case "done":
        return renderDone();
    }
  };

  const renderButtons = () => {
    const isFirst = step === "welcome";
    const isLast = step === "done";

    if (isLast) {
      return (
        <Button onClick={onComplete} className="w-full max-w-xs">
          开始使用 DevDash
        </Button>
      );
    }

    return (
      <div className="flex gap-3 justify-center">
        {!isFirst && (
          <Button variant="outline" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            上一步
          </Button>
        )}
        <Button
          onClick={() => {
            if (step === "source") {
              handleTestAndSaveSource();
            } else if (step === "ai") {
              handleTestAndSaveAi();
            } else {
              handleNext();
            }
          }}
          disabled={(step === "source" && testingSource) || (step === "ai" && testingAi)}
        >
          {step === "source" || step === "ai" ? (
            testingSource || testingAi ? (
              "测试中..."
            ) : (
              <>
                测试并保存
                <Check className="w-4 h-4 ml-1" />
              </>
            )
          ) : (
            <>
              下一步
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto p-8 relative">
        {/* Close button - hidden on first step */}
        {step !== "welcome" && (
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* Step indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <div className="min-h-[300px] flex flex-col justify-center">
          {renderContent()}
        </div>

        {/* Buttons */}
        <div className="mt-8">{renderButtons()}</div>
      </Card>
    </div>
  );
}
