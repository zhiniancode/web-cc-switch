import { useState, type FormEvent } from "react";
import { LockKeyhole, Shield } from "lucide-react";

interface LoginScreenProps {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (password: string) => Promise<void>;
}

export function LoginScreen({
  isSubmitting,
  errorMessage,
  onSubmit,
}: LoginScreenProps) {
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(password);
  };

  return (
    <main className="login-shell">
      <div className="login-orb login-orb-left" />
      <div className="login-orb login-orb-right" />

      <section className="login-panel">
        <div className="surface-accent" />
        <div className="eyebrow">
          <Shield size={16} />
          <span>config.everso.top</span>
        </div>

        <h1>CC Switch Web</h1>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span className="field-label">管理员密码</span>
            <div className="password-field">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="输入密码"
                autoFocus
                autoComplete="current-password"
              />
            </div>
          </label>

          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

          <button
            type="submit"
            className="primary-button login-button"
            disabled={isSubmitting || !password.trim()}
          >
            {isSubmitting ? "登录中..." : "进入控制台"}
          </button>
        </form>
      </section>
    </main>
  );
}
