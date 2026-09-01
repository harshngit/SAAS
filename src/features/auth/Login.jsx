import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Droplet } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FullScreenLoader from "../../components/ui/FullScreenLoader";
import AuthShowcase from "../../components/auth/AuthShowcase";
import { zodResolver } from "../../utils/zodResolver";
import { forgotPassword, googleLoginRedirect, login, resetPassword } from "../../api/auth";
import { roleHomePath } from "../../auth/roles";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetStep, setResetStep] = useState("email"); // 'email' | 'token'
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const performLogin = async (credentials) => {
    setServerError("");
    const result = await login(credentials);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setIsRedirecting(true);
    const redirectTo =
      location.state?.from?.pathname ||
      roleHomePath[result.user.role] ||
      "/admin/dashboard";
    navigate(redirectTo, { replace: true });
  };

  const startPasswordReset = () => {
    setServerError("");
    setResetError("");
    setResetMessage("");
    setResetInfo("");
    setResetStep("email");
    setIsResettingPassword(true);
  };

  const cancelPasswordReset = () => {
    setIsResettingPassword(false);
    setResetError("");
    setResetInfo("");
    setResetStep("email");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleRequestReset = async (event) => {
    event.preventDefault();
    setResetError("");

    if (!z.string().email().safeParse(resetEmail).success) {
      setResetError("Enter a valid email");
      return;
    }

    setIsResetSubmitting(true);
    const result = await forgotPassword({ email: resetEmail });
    setIsResetSubmitting(false);

    if (!result.success) {
      setResetError(result.error);
      return;
    }

    setResetInfo(result.detail);
    if (result.resetToken) setResetToken(result.resetToken);
    setResetStep("token");
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setResetError("");

    if (!resetToken.trim()) {
      setResetError("Enter the reset token from your email");
      return;
    }

    if (newPassword.length < 8) {
      setResetError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match");
      return;
    }

    setIsResetSubmitting(true);
    const result = await resetPassword({ token: resetToken.trim(), newPassword });
    setIsResetSubmitting(false);

    if (!result.success) {
      setResetError(result.error);
      return;
    }

    setResetMessage(result.detail);
    setIsResettingPassword(false);
    setResetStep("email");
    setResetEmail("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  return (
    <div className="min-h-svh bg-neutral-50 p-4 sm:p-6 lg:p-8">
      {isRedirecting && <FullScreenLoader label="Signing you in..." />}
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-2xl border border-neutral-200 bg-white p-3 shadow-popover sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="Live workspace"
          title="Run distribution from one dashboard"
          description="Track orders, stock, invoices, deliveries and payments with role-based access for every team."
          quote="SAAS CRM keeps our sales, delivery and accounts teams aligned from first order to final collection."
          name="Isabella Garcia"
          role="Operations Director"
        />

        <main className="flex min-h-full w-full flex-col items-center justify-center overflow-y-auto px-4 py-8 lg:w-1/2 lg:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-(--shadow-glow-primary)">
                <Droplet className="size-5" />
              </div>
              <span className="font-(--font-display) text-lg font-semibold tracking-tight text-primary-700">
                SAAS CRM
              </span>
            </div>

            <h1 className="text-center font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-center text-sm text-neutral-500">
              Sign in to your workspace to continue
            </p>

            {isResettingPassword ? (
              <form
                onSubmit={resetStep === "email" ? handleRequestReset : handlePasswordReset}
                className="mt-7 space-y-4"
              >
                {resetStep === "email" ? (
                  <>
                    <Input
                      label="Email"
                      type="email"
                      placeholder="you@company.com"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      error={resetError}
                    />
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900"
                      loading={isResetSubmitting}
                    >
                      Send Reset Link
                    </Button>
                  </>
                ) : (
                  <>
                    {resetInfo && (
                      <p className="rounded-xl bg-primary-50 px-3.5 py-2.5 text-sm text-primary-800">{resetInfo}</p>
                    )}
                    <Input
                      label="Reset Token"
                      placeholder="Paste the token from your email"
                      value={resetToken}
                      onChange={(event) => setResetToken(event.target.value)}
                    />
                    <Input
                      label="New Password"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(event) => setConfirmNewPassword(event.target.value)}
                    />
                    {resetError && (
                      <p className="text-sm text-red-600">{resetError}</p>
                    )}
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900"
                      loading={isResetSubmitting}
                    >
                      Reset Password
                    </Button>
                  </>
                )}

                <button
                  type="button"
                  onClick={cancelPasswordReset}
                  className="w-full text-center text-sm font-medium text-primary-600 hover:underline"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleSubmit(performLogin)}
                className="mt-7 space-y-4"
              >
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@company.com"
                  error={errors.email?.message}
                  {...register("email")}
                />

                <div className="space-y-2">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    error={errors.password?.message}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={startPasswordReset}
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {serverError && (
                  <p className="text-sm text-red-600">{serverError}</p>
                )}

                {resetMessage && (
                  <p className="text-sm text-emerald-600">{resetMessage}</p>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900"
                  loading={isSubmitting || isRedirecting}
                >
                  Sign in
                </Button>

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs font-medium text-neutral-400">OR</span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <button
                  type="button"
                  onClick={googleLoginRedirect}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-medium text-neutral-700 shadow-(--shadow-xs) transition-colors hover:bg-neutral-50"
                >
                  <FcGoogle className="size-5" aria-hidden="true" />
                  Continue with Google
                </button>
              </form>
            )}

            <p className="mt-8 text-center text-sm text-neutral-500">
              New organization?{" "}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:underline"
              >
                Register here
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
