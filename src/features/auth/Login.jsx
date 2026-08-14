import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Droplet } from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import FullScreenLoader from "../../components/ui/FullScreenLoader";
import AuthShowcase from "../../components/auth/AuthShowcase";
import { zodResolver } from "../../utils/zodResolver";
import { login, resetPasswordDirect } from "../../api/auth";
import { roleHomePath } from "../../auth/roles";
import { FaGoogle } from "react-icons/fa";
import ReactCountryFlag from "react-country-flag";

const countryCodes = [
  { value: "IN:+91", code: "+91", flag: "\u{1F1EE}\u{1F1F3}", label: "\u{1F1EE}\u{1F1F3} +91" },
  { value: "US:+1", code: "+1", flag: "\u{1F1FA}\u{1F1F8}", label: "\u{1F1FA}\u{1F1F8} +1" },
  { value: "GB:+44", code: "+44", flag: "\u{1F1EC}\u{1F1E7}", label: "\u{1F1EC}\u{1F1E7} +44" },
  { value: "AE:+971", code: "+971", flag: "\u{1F1E6}\u{1F1EA}", label: "\u{1F1E6}\u{1F1EA} +971" },
  { value: "AU:+61", code: "+61", flag: "\u{1F1E6}\u{1F1FA}", label: "\u{1F1E6}\u{1F1FA} +61" },
  { value: "JP:+81", code: "+81", flag: "\u{1F1EF}\u{1F1F5}", label: "\u{1F1EF}\u{1F1F5} +81" },
  { value: "CN:+86", code: "+86", flag: "\u{1F1E8}\u{1F1F3}", label: "\u{1F1E8}\u{1F1F3} +86" },
  { value: "DE:+49", code: "+49", flag: "\u{1F1E9}\u{1F1EA}", label: "\u{1F1E9}\u{1F1EA} +49" },
  { value: "FR:+33", code: "+33", flag: "\u{1F1EB}\u{1F1F7}", label: "\u{1F1EB}\u{1F1F7} +33" },
  { value: "IT:+39", code: "+39", flag: "\u{1F1EE}\u{1F1F9}", label: "\u{1F1EE}\u{1F1F9} +39" },
  { value: "ES:+34", code: "+34", flag: "\u{1F1EA}\u{1F1F8}", label: "\u{1F1EA}\u{1F1F8} +34" },
  { value: "NL:+31", code: "+31", flag: "\u{1F1F3}\u{1F1F1}", label: "\u{1F1F3}\u{1F1F1} +31" },
  { value: "SG:+65", code: "+65", flag: "\u{1F1F8}\u{1F1EC}", label: "\u{1F1F8}\u{1F1EC} +65" },
  { value: "MY:+60", code: "+60", flag: "\u{1F1F2}\u{1F1FE}", label: "\u{1F1F2}\u{1F1FE} +60" },
  { value: "TH:+66", code: "+66", flag: "\u{1F1F9}\u{1F1ED}", label: "\u{1F1F9}\u{1F1ED} +66" },
  { value: "BD:+880", code: "+880", flag: "\u{1F1E7}\u{1F1E9}", label: "\u{1F1E7}\u{1F1E9} +880" },
  { value: "PK:+92", code: "+92", flag: "\u{1F1F5}\u{1F1F0}", label: "\u{1F1F5}\u{1F1F0} +92" },
  { value: "LK:+94", code: "+94", flag: "\u{1F1F1}\u{1F1F0}", label: "\u{1F1F1}\u{1F1F0} +94" },
  { value: "ZA:+27", code: "+27", flag: "\u{1F1FF}\u{1F1E6}", label: "\u{1F1FF}\u{1F1E6} +27" },
  { value: "BR:+55", code: "+55", flag: "\u{1F1E7}\u{1F1F7}", label: "\u{1F1E7}\u{1F1F7} +55" },
  { value: "MX:+52", code: "+52", flag: "\u{1F1F2}\u{1F1FD}", label: "\u{1F1F2}\u{1F1FD} +52" },
  { value: "CA:+1", code: "+1", flag: "\u{1F1E8}\u{1F1E6}", label: "\u{1F1E8}\u{1F1E6} +1" },
];

const phonePlaceholders = {
  "IN:+91": "98450 11223",
  "US:+1": "202 555 0143",
  "GB:+44": "7400 123456",
  "AE:+971": "50 123 4567",
  "AU:+61": "412 345 678",
  "JP:+81": "90 1234 5678",
  "CN:+86": "138 0013 8000",
  "DE:+49": "1512 3456789",
  "FR:+33": "6 12 34 56 78",
  "IT:+39": "312 345 6789",
  "ES:+34": "612 34 56 78",
  "NL:+31": "6 12345678",
  "SG:+65": "8123 4567",
  "MY:+60": "12 345 6789",
  "TH:+66": "81 234 5678",
  "BD:+880": "1712 345678",
  "PK:+92": "300 1234567",
  "LK:+94": "71 234 5678",
  "ZA:+27": "82 123 4567",
  "BR:+55": "11 91234 5678",
  "MX:+52": "55 1234 5678",
  "CA:+1": "416 555 0198",
};

const schema = z
  .object({
    loginMethod: z.enum(["email", "phone"]).default("email"),
    email: z.string().optional(),
    countryCode: z.string().default("IN:+91"),
    phone: z.string().optional(),
    password: z.string().optional(),
    otp: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.loginMethod === "email" &&
      !z.string().email().safeParse(data.email).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email",
        path: ["email"],
      });
    }

    if (data.loginMethod === "email" && !data.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required",
        path: ["password"],
      });
    }

    if (
      data.loginMethod === "phone" &&
      (data.phone || "").replace(/\D/g, "").length < 10
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid phone number",
        path: ["phone"],
      });
    }

    if (data.loginMethod === "phone" && !/^\d{6}$/.test(data.otp || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter the 6 digit OTP",
        path: ["otp"],
      });
    }
  });

function AppleLogo({ className = "size-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M16.47 12.3c-.03-2.78 2.27-4.12 2.37-4.18-1.29-1.89-3.3-2.15-4.01-2.18-1.71-.17-3.34 1-4.21 1-.87 0-2.21-.98-3.64-.95-1.87.03-3.6 1.09-4.56 2.77-1.95 3.38-.5 8.38 1.4 11.12.93 1.34 2.04 2.85 3.5 2.8 1.4-.06 1.93-.91 3.63-.91s2.17.91 3.65.88c1.51-.03 2.47-1.37 3.39-2.72 1.07-1.56 1.51-3.07 1.54-3.15-.03-.01-2.94-1.13-3.06-4.48Zm-2.76-8.16c.77-.93 1.29-2.22 1.15-3.51-1.11.04-2.45.74-3.25 1.67-.71.82-1.34 2.14-1.17 3.4 1.23.09 2.5-.63 3.27-1.56Z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetStep, setResetStep] = useState("email");
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const countryMenuRef = useRef(null);
  const otpInputRefs = useRef([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { loginMethod: "email", countryCode: "IN:+91" },
  });

  const loginMethod = watch("loginMethod");
  const phoneValue = watch("phone");
  const countryCodeValue = watch("countryCode");
  const selectedCountry =
    countryCodes.find((country) => country.value === countryCodeValue) ||
    countryCodes[0];
  const phonePlaceholder =
    phonePlaceholders[selectedCountry.value] || "Phone number";

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        countryMenuRef.current &&
        !countryMenuRef.current.contains(event.target)
      ) {
        setIsCountryMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const performLogin = async (credentials) => {
    setServerError("");
    const result = await login({
      ...(credentials.loginMethod === "phone"
        ? {
            phone: `${selectedCountry.code} ${credentials.phone}`,
            otp: credentials.otp,
          }
        : { email: credentials.email, password: credentials.password }),
    });
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

  const switchLoginMethod = (method) => {
    setServerError("");
    setResetMessage("");
    setOtpSent(false);
    setOtpMessage("");
    resetOtp();
    setValue("loginMethod", method);
  };

  const selectCountryCode = (country) => {
    setValue("countryCode", country.value);
    setIsCountryMenuOpen(false);
    setOtpSent(false);
    setOtpMessage("");
    resetOtp();
  };

  const startPasswordReset = () => {
    setServerError("");
    setResetError("");
    setResetMessage("");
    setResetStep("email");
    setIsResettingPassword(true);
  };

  const cancelPasswordReset = () => {
    setIsResettingPassword(false);
    setResetError("");
    setResetMessage("");
    setResetStep("email");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleResetEmailNext = (event) => {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!z.string().email().safeParse(resetEmail).success) {
      setResetError("Enter a valid email");
      return;
    }

    setResetStep("password");
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setResetError("");
    setResetMessage("");

    if (!z.string().email().safeParse(resetEmail).success) {
      setResetError("Enter a valid email");
      setResetStep("email");
      return;
    }

    if (!newPassword) {
      setResetError("New password is required");
      return;
    }

    if (!confirmNewPassword) {
      setResetError("Confirm new password is required");
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
    const result = await resetPasswordDirect({ email: resetEmail, newPassword });
    setIsResetSubmitting(false);

    if (!result.success) {
      setResetError(result.error);
      return;
    }

    setResetMessage(result.detail);
    setIsResettingPassword(false);
    setResetStep("email");
    setResetEmail("");
    setNewPassword("");
    setConfirmNewPassword("");
    navigate("/login", { replace: true });
  };

  const requestOtp = () => {
    const phoneDigits = (phoneValue || "").replace(/\D/g, "");
    setServerError("");
    setOtpMessage("");
    resetOtp();

    if (phoneDigits.length < 10) {
      setOtpSent(false);
      setServerError("Enter a valid phone number");
      return;
    }

    setOtpSent(true);
    setOtpMessage(`OTP sent to ${selectedCountry.code} ${phoneValue}`);
  };

  const resetOtp = () => {
    setOtpDigits(Array(6).fill(""));
    setValue("otp", "");
  };

  const applyOtpDigits = (digits, focusIndex) => {
    const nextDigits = Array(6).fill("");
    digits.slice(0, 6).forEach((digit, index) => {
      nextDigits[index] = digit;
    });
    setOtpDigits(nextDigits);
    setValue("otp", nextDigits.join(""));
    otpInputRefs.current[Math.min(focusIndex, 5)]?.focus();
  };

  const updateOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = digit;
    setOtpDigits(nextDigits);
    setValue("otp", nextDigits.join(""));

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");
    applyOtpDigits(digits, digits.length);
  };

  return (
    <div className="min-h-svh bg-neutral-50 p-4 sm:p-6 lg:p-8">
      {isRedirecting && <FullScreenLoader label="Signing you in..." />}
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-3 shadow-popover sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)]">
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

            <div className="mt-7 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50"
              >
                <FaGoogle className="size-4" />
                Continue with Google
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50"
              >
                <AppleLogo className="size-5" />
                Continue with Apple
              </button>
              {!isResettingPassword && (
                <div className="flex rounded-xl border border-neutral-200 bg-neutral-50 p-1 text-sm shadow-xs">
                  {[
                    ["email", "Email"],
                    ["phone", "Phone No"],
                  ].map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => switchLoginMethod(method)}
                      className={`flex-1 rounded-lg px-3 py-2 font-medium transition-colors ${
                        loginMethod === method
                          ? "bg-white text-neutral-900 shadow-xs"
                          : "text-neutral-500 hover:text-neutral-900"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isResettingPassword ? (
              <form
                onSubmit={
                  resetStep === "email" ? handleResetEmailNext : handlePasswordReset
                }
                className="mt-6 space-y-4"
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
                    >
                      Next
                    </Button>
                  </>
                ) : (
                  <>
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
                      onChange={(event) =>
                        setConfirmNewPassword(event.target.value)
                      }
                    />
                    {resetError && (
                      <p className="text-sm text-red-600">{resetError}</p>
                    )}
                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900"
                      loading={isResetSubmitting}
                    >
                      Reset
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
                className="mt-6 space-y-4"
              >
                <input type="hidden" {...register("loginMethod")} />

                {loginMethod === "email" ? (
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@company.com"
                    error={errors.email?.message}
                    {...register("email")}
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      Phone Number
                    </label>
                    <div className="grid grid-cols-[1fr_4fr] gap-2">
                      <div className="relative h-full" ref={countryMenuRef}>
                        <input type="hidden" {...register("countryCode")} />
                        <button
                          type="button"
                          aria-label="Country code"
                          aria-expanded={isCountryMenuOpen}
                          onClick={() =>
                            setIsCountryMenuOpen((isOpen) => !isOpen)
                          }
                          className="flex h-full w-full items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-3 pr-9 text-sm text-neutral-900 transition-all focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                        >
                          <ReactCountryFlag
                            countryCode={selectedCountry.value.split(":")[0]}
                            svg
                          />
                          <span>{selectedCountry.code}</span>
                        </button>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
                          aria-hidden="true"
                        />
                        {isCountryMenuOpen && (
                          <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-popover">
                            {countryCodes.map((country) => (
                              <button
                                key={country.value}
                                type="button"
                                onClick={() => selectCountryCode(country)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                  selectedCountry.value === country.value
                                    ? "bg-primary-50 text-primary-700"
                                    : "text-neutral-900 hover:bg-neutral-50"
                                }`}
                              >
                                <ReactCountryFlag
                                  countryCode={country.value.split(":")[0]}
                                  svg
                                />
                                <span>{country.code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="tel"
                        placeholder={phonePlaceholder}
                        className={`h-full w-full rounded-xl border bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-900 transition-all placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-4 ${
                          errors.phone
                            ? "border-red-300 focus:border-red-400 focus:ring-red-500/15"
                            : "border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12"
                        }`}
                        {...register("phone", {
                          onChange: () => {
                            setOtpSent(false);
                            setOtpMessage("");
                            resetOtp();
                          },
                        })}
                      />
                    </div>
                    {errors.phone && (
                      <span className="text-xs text-red-600">
                        {errors.phone.message}
                      </span>
                    )}
                  </div>
                )}

                {loginMethod === "phone" && (
                  <>
                    {!otpSent && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={requestOtp}
                      >
                        Get OTP
                      </Button>
                    )}

                    {otpSent && (
                      <div className="space-y-3">
                        <input type="hidden" {...register("otp")} />
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-neutral-700">
                            OTP
                          </label>
                          <div
                            className="grid grid-cols-6 gap-2"
                            onPaste={handleOtpPaste}
                          >
                            {otpDigits.map((digit, index) => (
                              <input
                                key={index}
                                ref={(element) => {
                                  otpInputRefs.current[index] = element;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                aria-label={`OTP digit ${index + 1}`}
                                value={digit}
                                onChange={(event) =>
                                  updateOtpDigit(index, event.target.value)
                                }
                                onKeyDown={(event) =>
                                  handleOtpKeyDown(index, event)
                                }
                                className={`aspect-square w-full rounded-xl border bg-neutral-50 text-center font-(--font-display) text-lg font-semibold text-neutral-900 transition-all focus:bg-white focus:outline-none focus:ring-4 ${
                                  errors.otp
                                    ? "border-red-300 focus:border-red-400 focus:ring-red-500/15"
                                    : "border-neutral-200 focus:border-primary-400 focus:ring-primary-500/12"
                                }`}
                              />
                            ))}
                          </div>
                          {errors.otp && (
                            <span className="text-xs text-red-600">
                              {errors.otp.message}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-neutral-500">{otpMessage}</span>
                          <button
                            type="button"
                            onClick={requestOtp}
                            className="font-medium text-primary-600 hover:underline"
                          >
                            Resend OTP
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {loginMethod === "email" && (
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
                )}

                {serverError && (
                  <p className="text-sm text-red-600">{serverError}</p>
                )}

                {resetMessage && (
                  <p className="text-sm text-emerald-600">{resetMessage}</p>
                )}

                {(loginMethod === "email" || otpSent) && (
                  <Button
                    type="submit"
                    className="w-full rounded-xl bg-linear-to-b from-neutral-800 to-neutral-950 shadow-[0_10px_24px_-10px_rgb(17_24_39/0.55)] hover:from-neutral-800 hover:to-neutral-900"
                    loading={isSubmitting || isRedirecting}
                  >
                    Sign in
                  </Button>
                )}
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