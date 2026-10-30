import { platformHomeForUser } from '../../auth/platformRoles'
import PhoneOtpLogin from "./PhoneOtpLogin";
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
import AuthFooterLinks from "../../components/auth/AuthFooterLinks";
import { zodResolver } from "../../utils/zodResolver";
import { forgotPassword, googleLoginRedirect, login } from "../../api/auth";
import { roleHomePath } from "../../auth/roles";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loginMethod, setLoginMethod] = useState("email");
  const [mobileAvailable, setMobileAvailable] = useState(() => {
    try { return sessionStorage.getItem('beas-mobile-login-disabled') !== 'true'; } catch { return true; }
  });
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [isResettingPassword, setIsResettingPassword] = useState(Boolean(location.state?.forgotPassword));
  const [resetSent, setResetSent] = useState(false);
  const [resetDetail, setResetDetail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState(location.state?.message || "");
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
    finishLogin(result);
  };

  const finishLogin = (result) => {
    setIsRedirecting(true);
    const redirectTo =
      platformHomeForUser(result.user) ||
      location.state?.from?.pathname ||
      roleHomePath[result.user.role] ||
      "/admin/dashboard";
    navigate(redirectTo, { replace: true });
  };

  const startPasswordReset = () => {
    setServerError("");
    setResetError("");
    setResetMessage("");
    setResetSent(false);
    setIsResettingPassword(true);
  };

  const cancelPasswordReset = () => {
    setIsResettingPassword(false);
    setResetError("");
    setResetSent(false);
  };

  const handleRequestReset = async (event) => {
    event.preventDefault();
    if (isResetSubmitting || resetSent) return;
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

    setResetDetail(result.detail);
    setResetSent(true);
  };


  return (
    <div className="min-h-svh bg-neutral-50 p-4 sm:p-6 lg:p-8">
      {isRedirecting && <FullScreenLoader label="Signing you in..." />}
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-2xl border border-neutral-200 bg-surface p-3 shadow-popover sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)]">
        <AuthShowcase
          kicker="Live workspace"
          title="Run distribution from one dashboard"
          description="Track orders, stock, invoices, deliveries and payments with role-based access for every team."
          quote="Beas Suite keeps our sales, delivery and accounts teams aligned from first order to final collection."
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
                Beas Suite
              </span>
            </div>

            <h1 className="text-center font-(--font-display) text-2xl font-semibold tracking-tight text-neutral-900">
              Welcome back
            </h1>
            <p className="mt-1.5 text-center text-sm text-neutral-500">
              Sign in to your workspace to continue
            </p>

            {!isResettingPassword && mobileAvailable && <div role="group" aria-label="Sign-in method" className="mt-7 rounded-xl bg-primary-50 p-1">
              <div className="relative grid grid-cols-2">
              <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-lg bg-primary-600 shadow-(--shadow-xs) transition-transform duration-300 ease-in-out motion-reduce:transition-none ${loginMethod === 'phone' ? 'translate-x-full' : 'translate-x-0'}`} />
              {[['email', 'Email'], ['phone', 'Mobile']].map(([method, label]) => (
                <button key={method} type="button" aria-pressed={loginMethod === method} disabled={isSubmitting || phoneBusy || isRedirecting}
                  onClick={() => { setLoginMethod(method); setServerError(''); }}
                  className={`relative z-10 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-300 ease-in-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-wait ${loginMethod === method ? 'text-white disabled:text-white disabled:opacity-100' : 'text-primary-700 hover:text-primary-900 disabled:opacity-60'}`}>
                  {label}
                </button>
              ))}
              </div>
            </div>}

            {isResettingPassword ? (
              <form onSubmit={handleRequestReset} className="mt-7 space-y-4">
                {resetSent ? (
                  <p role="status" className="rounded-xl bg-primary-50 px-3.5 py-2.5 text-sm text-primary-800">
                    {resetDetail}
                  </p>
                ) : (
                  <>
                    <Input label="Email" type="email" autoComplete="email" autoCapitalize="none" placeholder="you@company.com"
                      value={resetEmail} disabled={isResetSubmitting} onChange={(event) => setResetEmail(event.target.value)} error={resetError} />
                    <Button type="submit" className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900" loading={isResetSubmitting}>
                      Send Reset Link
                    </Button>
                  </>
                )}
                <button type="button" onClick={cancelPasswordReset} disabled={isResetSubmitting}
                  className="w-full text-center text-sm font-medium text-primary-600 hover:underline">
                  Back to sign in
                </button>
              </form>
            ) : (
              <>
              <div hidden={loginMethod !== 'phone'}>
                <PhoneOtpLogin onSuccess={finishLogin} onBusyChange={setPhoneBusy} onUnavailable={() => {
                  try { sessionStorage.setItem('beas-mobile-login-disabled', 'true'); } catch { /* Still hide it in memory. */ }
                  setMobileAvailable(false); setLoginMethod('email');
                  setServerError('Mobile login is temporarily unavailable. Please use email login.');
                }} disabled={isRedirecting} />
              </div>
              <div hidden={loginMethod !== 'email'}>
              <form
                onSubmit={handleSubmit(performLogin)}
                className="mt-7 space-y-4"
              >
                <Input
                  label="Email"
                  type="email"
                  autoCapitalize="none"
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


              </form>
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <span className="text-xs font-medium text-neutral-400">OR</span>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                <button
                  type="button"
                  onClick={googleLoginRedirect}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-surface py-2.5 text-sm font-medium text-neutral-700 shadow-(--shadow-xs) transition-colors hover:bg-neutral-50"
                >
                  <FcGoogle className="size-5" aria-hidden="true" />
                  Continue with Google
                </button>
              </div>
              </>
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
            <AuthFooterLinks />
          </div>
        </main>
      </div>
    </div>
  );
}
