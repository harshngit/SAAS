import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  KeyRound,
  LifeBuoy,
  Pencil,
  Save,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import { changePassword, getCurrentProfile } from "../../api/auth";
import {
  clearOrganizationOtherDocuments,
  getOrganizationOtherDocuments,
  getOrganizationSettings,
  updateOrganizationSettings,
  uploadOrganizationLogo,
  uploadOrganizationOtherDocuments,
  uploadOrganizationSettingsFile,
  uploadOrganizationSignature,
} from "../../api/organizations";
import { updateUser } from "../../api/users";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../components/ui/toastContext";

const maxCompanyFileSize = 5 * 1024 * 1024;
const supportedCompanyFileExtensions = /\.(doc|docx|pdf)$/i;
const supportedCompanyDocumentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const supportedOtherBusinessDocumentTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function isSupportedCompanyFile(file) {
  return (
    file.type.startsWith("image/") ||
    supportedCompanyDocumentTypes.has(file.type) ||
    supportedCompanyFileExtensions.test(file.name)
  );
}

function isSupportedOtherBusinessDocumentFile(file) {
  return (
    supportedOtherBusinessDocumentTypes.has(file.type) ||
    /\.(pdf|png|jpe?g|docx)$/i.test(file.name)
  );
}

function splitStoredFiles(value) {
  const storedValue = String(value || "").trim();

  if (!storedValue) return [];
  if (storedValue.startsWith("data:")) return [storedValue];

  return storedValue
    .split(",")
    .map((fileUrl) => fileUrl.trim())
    .filter(Boolean);
}

function splitStoredFileNames(displayName, fileCount) {
  const names = String(displayName || "")
    .split(", ")
    .map((name) => name.trim())
    .filter(Boolean);

  return Array.from({ length: fileCount }, (_, index) => names[index] || "");
}

function getFileNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const pathName = parsedUrl.pathname.split("/").filter(Boolean).pop();
    return pathName ? decodeURIComponent(pathName) : "Uploaded document";
  } catch {
    const pathName = String(url).split("?")[0].split("/").filter(Boolean).pop();
    return pathName ? decodeURIComponent(pathName) : "Uploaded document";
  }
}

function getPreviewFileKind({ name = "", type = "", url = "" }) {
  const fileHint = `${name} ${url}`.toLowerCase();

  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i.test(fileHint)
  ) {
    return "image";
  }

  if (type === "application/pdf" || /\.pdf(?:$|[?#])/i.test(fileHint)) {
    return "pdf";
  }

  if (
    type === "application/msword" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.(doc|docx)(?:$|[?#])/i.test(fileHint)
  ) {
    return "word";
  }

  return "file";
}

function buildPreviewFiles({ value, displayName, fileType }) {
  const urls = splitStoredFiles(value);
  const names = splitStoredFileNames(displayName, urls.length);

  return urls.map((url, index) => {
    const name = names[index] || getFileNameFromUrl(url);
    const type = urls.length === 1 ? fileType : "";

    return {
      url,
      name,
      type,
      kind: getPreviewFileKind({ name, type, url }),
    };
  });
}

function createObjectUrlFromDataUrl(dataUrl) {
  const [meta = "", encodedData = ""] = dataUrl.split(",");
  const mimeType = meta.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";
  const binary = window.atob(encodedData);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function openFileInNewTab(fileUrl) {
  if (!fileUrl) return;

  if (fileUrl.startsWith("data:")) {
    const objectUrl = createObjectUrlFromDataUrl(fileUrl);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

function buildOtherDocumentsFieldState(documents = []) {
  return {
    urls: documents
      .map((document) => document?.url)
      .filter(Boolean)
      .join(","),
    names: documents
      .map((document) => document?.name)
      .filter(Boolean)
      .join(", "),
    types: documents
      .map((document) => document?.content_type)
      .filter(Boolean)
      .join(", "),
  };
}

const initialCompanyData = {
  name: "SAAS Distributors",
  legalName: "",
  email: "info@saasdistributors.com",
  phone: "+91 9876543210",
  address: "123 Main Street, Business District",
  country: "india",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  fax: "",
  gstin: "27AABCU9603R1ZX",
  dateOfIncorporation: "",
  cinRegistrationNumber: "",
  companyDescription: "",
  industry: "",
  businessType: "",
  panNumber: "",
  financialYear: "",
  alternateMobileNumber: "",
  landlineNumber: "",
  customerSupportNumber: "",
  registeredAddress: "",
  branchOfficeAddresses: "",
  billingAddressSameAsRegistered: false,
  billingAddress: "",
  shippingAddressSameAsBilling: false,
  shippingAddress: "",
  website: "",
  invoicePrefix: "",
  logoUrl: "",
  signatureUrl: "",
  stampSealUrl: "",
  letterheadFile: "",
  bannerUrl: "",
  qrCodeUrl: "",
  upiId: "",
  bankAccountDetails: "",
  accountHolderName: "",
  ifscCode: "",
  bankName: "",
  facebook: "",
  instagram: "",
  linkedin: "",
  xTwitter: "",
  youtube: "",
  whatsappBusinessNumber: "",
  currency: "",
  timeZone: "",
  language: "",
  taxConfiguration: "",
  invoiceSettings: "",
  gstCertificateFile: "",
  panCardFile: "",
  incorporationCertificateFile: "",
  tradeLicenseFile: "",
  msmeCertificateFile: "",
  fssaiLicenseFile: "",
  otherBusinessDocumentsFile: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  ownerDirectorName: "",
  designation: "",
  mobileNumber: "",
  profilePhotoUrl: "",
  digitalSignatureUrl: "",
  numberOfEmployees: "",
  businessHours: "",
  companyMissionVision: "",
  notes: "",
  status: "active",
};

const settingsNav = [
  {
    id: "account",
    label: "Account",
    icon: UserRound,
    description: "Manage primary admin registration details.",
  },
  {
    id: "general",
    label: "General Information",
    icon: Building2,
    description:
      "Update public company details used across invoices and reports.",
  },
  {
    id: "billings",
    label: "Billings",
    icon: CreditCard,
    description: "Manage digital payment and bank details.",
  },
  {
    id: "branding",
    label: "Branding & Identity",
    icon: Building2,
    description: "Manage company logo, signature, and document branding.",
  },
  {
    id: "online-presence",
    label: "Online Presence",
    icon: Building2,
    description: "Manage social media and online business profiles.",
  },
  {
    id: "business-settings",
    label: "Business Settings",
    icon: CreditCard,
    description: "Manage accounting, tax, invoice, and localization settings.",
  },
  {
    id: "documents",
    label: "Documents",
    icon: CreditCard,
    description: "Manage compliance and registration documents.",
  },
  {
    id: "additional-info",
    label: "Additional Information",
    icon: Building2,
    description: "Manage operational details and internal notes.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Manage company alerts and communication settings.",
  },
  {
    id: "change-password",
    label: "Change Password",
    icon: KeyRound,
    description: "Update the admin account password.",
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    description: "View support contact information for your workspace.",
  },
];

const businessTypeOptions = [
  { value: "private-ltd", label: "Private Ltd" },
  { value: "public-ltd", label: "Public Ltd" },
  { value: "ngo", label: "NGO" },
  { value: "trust", label: "Trust" },
  { value: "sole-proprietorship", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "LLP" },
];

const industryOptions = [
  { value: "water-distribution", label: "Water Distribution" },
  { value: "beverages", label: "Beverages" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const designationOptions = [
  { value: "owner", label: "Owner" },
  { value: "director", label: "Director" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "sales-officer", label: "Sales Officer" },
];

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "locked", label: "Locked" },
];

const financialYearOptions = [
  { value: "2024-2025", label: "2024-2025" },
  { value: "2025-2026", label: "2025-2026" },
  { value: "2026-2027", label: "2026-2027" },
];

const stateOptions = [
  { value: "Andhra Pradesh", label: "Andhra Pradesh" },
  { value: "Delhi", label: "Delhi" },
  { value: "Gujarat", label: "Gujarat" },
  { value: "Karnataka", label: "Karnataka" },
  { value: "Maharashtra", label: "Maharashtra" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Tamil Nadu", label: "Tamil Nadu" },
  { value: "Telangana", label: "Telangana" },
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "West Bengal", label: "West Bengal" },
];

const countryOptions = [
  { value: "india", label: "India" },
  { value: "usa", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "uae", label: "United Arab Emirates" },
  { value: "singapore", label: "Singapore" },
];

const editableSectionIds = [
  "account",
  "general",
  "billings",
  "branding",
  "online-presence",
  "business-settings",
  "documents",
  "additional-info",
];

const currencyOptions = [
  { value: "INR", label: "INR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "AED", label: "AED" },
];

const timeZoneOptions = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
];

const languageOptions = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "mr", label: "Marathi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
];

const taxConfigurationOptions = [
  { value: "gst", label: "GST" },
  { value: "vat", label: "VAT" },
  { value: "none", label: "No Tax" },
];

const bankOptions = [
  { value: "hdfc", label: "HDFC Bank" },
  { value: "icici", label: "ICICI Bank" },
  { value: "sbi", label: "State Bank of India" },
  { value: "axis", label: "Axis Bank" },
  { value: "other", label: "Other" },
];

function CheckboxField({ label, name, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium text-neutral-700">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="size-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/20"
      />
      {label}
    </label>
  );
}

function FileUploadField({
  label,
  name,
  value,
  accept = "image/*",
  onChange,
  onRemove,
  disabled,
  required,
  uploadLabel = "Upload",
  uploading = false,
  displayName = "",
  error = "",
  previewAsImage = false,
  multiple = false,
  fileType = "",
  onPreview,
}) {
  const previewFiles = buildPreviewFiles({ value, displayName, fileType });
  const canPreview = previewFiles.length > 0;
  const isImagePreview =
    typeof value === "string" &&
    (value.startsWith("data:image") ||
      ((value.startsWith("http://") || value.startsWith("https://")) &&
        (previewAsImage || (!displayName && accept === "image/*"))));
  const displayValue =
    displayName || previewFiles.map((file) => file.name).join(", ");
  const previewContent = isImagePreview ? (
    <img
      src={value}
      alt={`${label} preview`}
      className="max-h-16 max-w-32 object-contain"
    />
  ) : canPreview ? (
    <FileText className="size-6 text-neutral-500" aria-hidden="true" />
  ) : (
    <Upload className="size-6 text-neutral-400" aria-hidden="true" />
  );

  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
      <div className="grid grid-cols-[9rem_1fr] gap-4">
        {canPreview ? (
          <button
            type="button"
            onClick={() => onPreview?.({ label, files: previewFiles })}
            className="flex h-20 w-36 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-xs font-medium text-neutral-400 transition-colors hover:border-primary-300 hover:bg-primary-50/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label={`Open ${label}`}
            title={`Open ${label}`}
          >
            {previewContent}
          </button>
        ) : (
          <div className="flex h-20 w-36 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-xs font-medium text-neutral-400">
            {previewContent}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-neutral-900">
            {label}
            {required && <span className="text-red-500"> *</span>}
          </p>
          {(uploading || displayValue) && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              {uploading ? "Uploading..." : displayValue}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium tracking-tight transition-all ${
                disabled || uploading
                  ? "cursor-not-allowed opacity-50 bg-linear-to-b from-primary-500 to-primary-600 text-white"
                  : "cursor-pointer bg-linear-to-b from-primary-500 to-primary-600 text-white shadow-[0_8px_20px_-6px_rgb(6_59_0/0.4)] hover:from-primary-500 hover:to-primary-700"
              }`}
            >
              <Upload className="size-4" />
              {uploading ? "Uploading..." : uploadLabel}
              <input
                type="file"
                accept={accept}
                multiple={multiple}
                disabled={disabled || uploading}
                onChange={(e) => onChange(name, e)}
                className="hidden"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || uploading || !value}
              onClick={() => onRemove(name)}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function CompanySection({
  number,
  title,
  description,
  children,
  isOpen,
  onToggle,
}) {
  const isCollapsible = typeof onToggle === "function";

  return (
    <section
      className={`${isCollapsible ? "border-b border-neutral-100 py-2.5 last:border-b-0" : "border-b border-neutral-100 py-5 last:border-b-0"}`}
    >
      {isCollapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className={`${isOpen ? "mb-4 border-primary-100 bg-primary-50/40" : "mb-0 border-neutral-100 bg-neutral-50"} flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors hover:bg-neutral-100`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
              {number}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-neutral-900">
                {title}
              </h3>
              <p className="text-xs text-neutral-500">{description}</p>
            </div>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
        </div>
      )}
      {(!isCollapsible || isOpen) && children}
    </section>
  );
}

function buildCompanyDataFromProfile(user, organization) {
  const registeredAddress =
    organization?.registered_address ||
    organization?.registeredAddress ||
    organization?.address ||
    initialCompanyData.address;

  return {
    ...initialCompanyData,
    name: organization?.name || initialCompanyData.name,
    legalName:
      organization?.legal_name ||
      organization?.legalName ||
      organization?.name ||
      "",
    email: organization?.email || initialCompanyData.email,
    phone:
      organization?.primary_mobile ||
      organization?.primaryMobile ||
      organization?.phone ||
      initialCompanyData.phone,
    address: organization?.address || initialCompanyData.address,
    city: organization?.city || initialCompanyData.city,
    state: organization?.state || initialCompanyData.state,
    country: organization?.country || initialCompanyData.country,
    pincode:
      organization?.pin_code ||
      organization?.pinCode ||
      organization?.pincode ||
      organization?.pin_zip_code ||
      initialCompanyData.pincode,
    gstin:
      organization?.gstin_pan ||
      organization?.gstinPan ||
      organization?.gst_number ||
      organization?.gstNumber ||
      initialCompanyData.gstin,
    dateOfIncorporation:
      organization?.date_of_incorporation ||
      organization?.dateOfIncorporation ||
      "",
    cinRegistrationNumber:
      organization?.cin_number ||
      organization?.cinNumber ||
      organization?.cin_registration_number ||
      organization?.cinRegistrationNumber ||
      "",
    companyDescription:
      organization?.description || organization?.companyDescription || "",
    industry: organization?.industry || "",
    businessType:
      organization?.business_type || organization?.businessType || "",
    panNumber: organization?.pan_number || organization?.panNumber || "",
    financialYear:
      organization?.financial_year || organization?.financialYear || "",
    alternateMobileNumber:
      organization?.alternate_mobile ||
      organization?.alternateMobile ||
      organization?.alternate_mobile_number ||
      organization?.alternateMobileNumber ||
      "",
    landlineNumber:
      organization?.landline ||
      organization?.landline_number ||
      organization?.landlineNumber ||
      "",
    customerSupportNumber:
      organization?.customer_support_number ||
      organization?.customerSupportNumber ||
      "",
    registeredAddress,
    branchOfficeAddresses:
      organization?.branch_address ||
      organization?.branchAddress ||
      organization?.branch_office_addresses ||
      organization?.branchOfficeAddresses ||
      "",
    billingAddress:
      organization?.billing_address ||
      organization?.billingAddress ||
      organization?.address ||
      "",
    logoUrl: organization?.logo_url || organization?.logoUrl || "",
    signatureUrl:
      organization?.signature_url || organization?.signatureUrl || "",
    stampSealUrl:
      organization?.stamp_url ||
      organization?.stampUrl ||
      organization?.stamp_seal_url ||
      organization?.stampSealUrl ||
      "",
    letterheadFile:
      organization?.letterhead_url ||
      organization?.letterheadUrl ||
      organization?.letterhead_file ||
      organization?.letterheadFile ||
      "",
    bannerUrl: organization?.banner_url || organization?.bannerUrl || "",
    qrCodeUrl:
      organization?.payment_qr_url ||
      organization?.paymentQrUrl ||
      organization?.qr_code_url ||
      organization?.qrCodeUrl ||
      "",
    upiId: organization?.upi_id || organization?.upiId || "",
    bankAccountDetails:
      organization?.bank_account_details ||
      organization?.bankAccountDetails ||
      "",
    accountHolderName:
      organization?.bank_account_holder ||
      organization?.bankAccountHolder ||
      organization?.account_holder_name ||
      organization?.accountHolderName ||
      "",
    ifscCode:
      organization?.bank_ifsc ||
      organization?.bankIfsc ||
      organization?.ifsc_code ||
      organization?.ifscCode ||
      "",
    bankName: organization?.bank_name || organization?.bankName || "",
    facebook:
      organization?.facebook_url ||
      organization?.facebookUrl ||
      organization?.facebook ||
      "",
    instagram:
      organization?.instagram_url ||
      organization?.instagramUrl ||
      organization?.instagram ||
      "",
    linkedin:
      organization?.linkedin_url ||
      organization?.linkedinUrl ||
      organization?.linkedin ||
      "",
    xTwitter:
      organization?.twitter_url ||
      organization?.twitterUrl ||
      organization?.x_twitter ||
      organization?.xTwitter ||
      "",
    youtube:
      organization?.youtube_url ||
      organization?.youtubeUrl ||
      organization?.youtube ||
      "",
    whatsappBusinessNumber:
      organization?.whatsapp_number ||
      organization?.whatsappNumber ||
      organization?.whatsapp_business_number ||
      organization?.whatsappBusinessNumber ||
      "",
    currency: organization?.currency || "",
    timeZone:
      organization?.timezone ||
      organization?.time_zone ||
      organization?.timeZone ||
      "",
    language: organization?.language || "",
    taxConfiguration:
      organization?.tax_configuration || organization?.taxConfiguration || "",
    invoiceSettings:
      organization?.invoice_settings || organization?.invoiceSettings || "",
    gstCertificateFile:
      organization?.doc_gst_url ||
      organization?.docGstUrl ||
      organization?.gst_certificate_file ||
      organization?.gstCertificateFile ||
      "",
    panCardFile:
      organization?.doc_pan_url ||
      organization?.docPanUrl ||
      organization?.pan_card_file ||
      organization?.panCardFile ||
      "",
    incorporationCertificateFile:
      organization?.doc_coi_url ||
      organization?.docCoiUrl ||
      organization?.incorporation_certificate_file ||
      organization?.incorporationCertificateFile ||
      "",
    tradeLicenseFile:
      organization?.doc_trade_license_url ||
      organization?.docTradeLicenseUrl ||
      organization?.trade_license_file ||
      organization?.tradeLicenseFile ||
      "",
    msmeCertificateFile:
      organization?.doc_msme_url ||
      organization?.docMsmeUrl ||
      organization?.msme_certificate_file ||
      organization?.msmeCertificateFile ||
      "",
    fssaiLicenseFile:
      organization?.doc_fssai_url ||
      organization?.docFssaiUrl ||
      organization?.fssai_license_file ||
      organization?.fssaiLicenseFile ||
      "",
    otherBusinessDocumentsFile:
      organization?.doc_other_url ||
      organization?.docOtherUrl ||
      organization?.other_business_documents_file ||
      organization?.otherBusinessDocumentsFile ||
      "",
    adminName: user?.name || "",
    adminEmail: user?.email || "",
    adminPhone: user?.phone || "",
    ownerDirectorName:
      organization?.auth_person_name ||
      organization?.authPersonName ||
      organization?.owner_director_name ||
      organization?.ownerDirectorName ||
      organization?.owner_name ||
      organization?.ownerName ||
      user?.name ||
      "",
    designation:
      organization?.auth_person_designation ||
      organization?.authPersonDesignation ||
      user?.designation ||
      user?.role ||
      "",
    mobileNumber:
      organization?.auth_person_mobile ||
      organization?.authPersonMobile ||
      user?.mobile_number ||
      user?.mobileNumber ||
      user?.phone ||
      "",
    profilePhotoUrl:
      organization?.auth_person_photo_url ||
      organization?.authPersonPhotoUrl ||
      user?.profile_photo_url ||
      user?.profilePhotoUrl ||
      "",
    digitalSignatureUrl:
      organization?.auth_person_signature_url ||
      organization?.authPersonSignatureUrl ||
      user?.digital_signature_url ||
      user?.digitalSignatureUrl ||
      "",
    numberOfEmployees:
      organization?.employee_count ??
      organization?.employeeCount ??
      organization?.number_of_employees ??
      organization?.numberOfEmployees ??
      "",
    businessHours:
      organization?.business_hours || organization?.businessHours || "",
    companyMissionVision:
      organization?.mission_vision ||
      organization?.missionVision ||
      organization?.company_mission_vision ||
      organization?.companyMissionVision ||
      "",
    notes: organization?.notes || "",
    status:
      user?.status ||
      organization?.status ||
      (user?.is_active === false ? "inactive" : "active"),
  };
}

function cleanCompanyValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function buildOrganizationSettingsRequest(companyData) {
  const billingAddress = companyData.billingAddressSameAsRegistered
    ? companyData.registeredAddress
    : companyData.billingAddress;

  const employeeCount =
    companyData.numberOfEmployees === ""
      ? null
      : Number(companyData.numberOfEmployees);

  return {
    name: cleanCompanyValue(companyData.name),
    business_type: cleanCompanyValue(companyData.businessType),
    gst_number: cleanCompanyValue(companyData.gstin),
    pan_number: cleanCompanyValue(companyData.panNumber),
    address: cleanCompanyValue(billingAddress || companyData.address),
    phone: cleanCompanyValue(companyData.phone),
    email: cleanCompanyValue(companyData.email),
    financial_year: cleanCompanyValue(companyData.financialYear),
    logo_url: cleanCompanyValue(companyData.logoUrl),
    signature_url: cleanCompanyValue(companyData.signatureUrl),
    legal_name: cleanCompanyValue(companyData.legalName),
    industry: cleanCompanyValue(companyData.industry),
    date_of_incorporation: cleanCompanyValue(companyData.dateOfIncorporation),
    cin_number: cleanCompanyValue(companyData.cinRegistrationNumber),
    gstin_pan: cleanCompanyValue(companyData.gstin),
    description: cleanCompanyValue(companyData.companyDescription),
    primary_mobile: cleanCompanyValue(companyData.phone),
    alternate_mobile: cleanCompanyValue(companyData.alternateMobileNumber),
    landline: cleanCompanyValue(companyData.landlineNumber),
    website: cleanCompanyValue(companyData.website),
    customer_support_number: cleanCompanyValue(
      companyData.customerSupportNumber,
    ),
    registered_address: cleanCompanyValue(companyData.registeredAddress),
    branch_address: cleanCompanyValue(companyData.branchOfficeAddresses),
    city: cleanCompanyValue(companyData.city),
    state: cleanCompanyValue(companyData.state),
    country: cleanCompanyValue(companyData.country),
    pin_code: cleanCompanyValue(companyData.pincode),
    stamp_url: cleanCompanyValue(companyData.stampSealUrl),
    letterhead_url: cleanCompanyValue(companyData.letterheadFile),
    banner_url: cleanCompanyValue(companyData.bannerUrl),
    payment_qr_url: cleanCompanyValue(companyData.qrCodeUrl),
    upi_id: cleanCompanyValue(companyData.upiId),
    bank_account_details: cleanCompanyValue(companyData.bankAccountDetails),
    bank_account_holder: cleanCompanyValue(companyData.accountHolderName),
    bank_ifsc: cleanCompanyValue(companyData.ifscCode),
    bank_name: cleanCompanyValue(companyData.bankName),
    facebook_url: cleanCompanyValue(companyData.facebook),
    instagram_url: cleanCompanyValue(companyData.instagram),
    linkedin_url: cleanCompanyValue(companyData.linkedin),
    twitter_url: cleanCompanyValue(companyData.xTwitter),
    youtube_url: cleanCompanyValue(companyData.youtube),
    whatsapp_number: cleanCompanyValue(companyData.whatsappBusinessNumber),
    currency: cleanCompanyValue(companyData.currency),
    timezone: cleanCompanyValue(companyData.timeZone),
    language: cleanCompanyValue(companyData.language),
    tax_configuration: cleanCompanyValue(companyData.taxConfiguration),
    invoice_settings: cleanCompanyValue(companyData.invoiceSettings),
    doc_gst_url: cleanCompanyValue(companyData.gstCertificateFile),
    doc_pan_url: cleanCompanyValue(companyData.panCardFile),
    doc_coi_url: cleanCompanyValue(companyData.incorporationCertificateFile),
    doc_trade_license_url: cleanCompanyValue(companyData.tradeLicenseFile),
    doc_msme_url: cleanCompanyValue(companyData.msmeCertificateFile),
    doc_fssai_url: cleanCompanyValue(companyData.fssaiLicenseFile),
    doc_other_url: cleanCompanyValue(companyData.otherBusinessDocumentsFile),
    auth_person_name: cleanCompanyValue(companyData.ownerDirectorName),
    auth_person_designation: cleanCompanyValue(companyData.designation),
    auth_person_mobile: cleanCompanyValue(companyData.mobileNumber),
    auth_person_email: cleanCompanyValue(companyData.adminEmail),
    auth_person_photo_url: cleanCompanyValue(companyData.profilePhotoUrl),
    auth_person_signature_url: cleanCompanyValue(
      companyData.digitalSignatureUrl,
    ),
    employee_count: Number.isNaN(employeeCount) ? null : employeeCount,
    business_hours: cleanCompanyValue(companyData.businessHours),
    mission_vision: cleanCompanyValue(companyData.companyMissionVision),
    notes: cleanCompanyValue(companyData.notes),
  };
}

export default function CompanySettings() {
  const { showToast } = useToast();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentOrganization = useAuthStore(
    (state) => state.currentOrganization,
  );
  const [companyData, setCompanyData] = useState(() =>
    buildCompanyDataFromProfile(currentUser, currentOrganization),
  );
  const [loadedUser, setLoadedUser] = useState(currentUser);
  const [loadedOrganization, setLoadedOrganization] =
    useState(currentOrganization);
  const [activeTab, setActiveTab] = useState("account");
  const [editingSections, setEditingSections] = useState({
    account: false,
    general: false,
  });
  const [openGeneralSections, setOpenGeneralSections] = useState({
    basic: true,
    contact: false,
    address: false,
  });
  const [openAccountSections, setOpenAccountSections] = useState({
    details: true,
    authorizedPerson: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState("");
  const [logoUploadError, setLogoUploadError] = useState("");
  const [pendingSignatureFile, setPendingSignatureFile] = useState(null);
  const [pendingSignaturePreview, setPendingSignaturePreview] = useState("");
  const [signatureUploadError, setSignatureUploadError] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [fileUploadErrors, setFileUploadErrors] = useState({});
  const [uploadedFileNames, setUploadedFileNames] = useState({});
  const [uploadedFileTypes, setUploadedFileTypes] = useState({});
  const activeNavItem =
    settingsNav.find((item) => item.id === activeTab) || settingsNav[0];
  const isEditableSection = editableSectionIds.includes(activeTab);
  const isActiveSectionEditing = Boolean(editingSections[activeTab]);
  const isAccountEditing = editingSections.account;
  const getUploadFieldState = (name) => {
    const fileCount = splitStoredFiles(companyData[name]).length;

    return {
      uploading: Boolean(uploadingFiles[name]),
      error: fileUploadErrors[name] || "",
      displayName: uploadedFileNames[name] || "",
      previewAsImage: Boolean(
        fileCount === 1 && uploadedFileTypes[name]?.startsWith("image/"),
      ),
      fileType: uploadedFileTypes[name] || "",
      onPreview: handleOpenDocumentPreview,
    };
  };

  function handleOpenDocumentPreview(preview) {
    const fileUrl = preview?.files?.[0]?.url;
    openFileInNewTab(fileUrl);
  }

  const resetCompanyData = useCallback(() => {
    setCompanyData(buildCompanyDataFromProfile(loadedUser, loadedOrganization));
  }, [loadedOrganization, loadedUser]);

  useEffect(() => {
    let isMounted = true;

    async function loadCompanySettings() {
      const [profileResult, settingsResult] = await Promise.all([
        getCurrentProfile(),
        getOrganizationSettings(),
      ]);

      if (!isMounted) return;

      if (!profileResult.success || !settingsResult.success) {
        setProfileError(profileResult.error || settingsResult.error);
        return;
      }

      const nextUser = profileResult.user;
      const nextOrganization =
        settingsResult.organization || profileResult.organization;

      setProfileError("");
      setLoadedUser(nextUser);
      setLoadedOrganization(nextOrganization);
      setCompanyData(buildCompanyDataFromProfile(nextUser, nextOrganization));

      const otherDocumentsResult = await getOrganizationOtherDocuments();
      if (!isMounted) return;

      if (otherDocumentsResult.success) {
        const otherDocuments = buildOtherDocumentsFieldState(
          otherDocumentsResult.documents,
        );
        setCompanyData((prev) => ({
          ...prev,
          otherBusinessDocumentsFile: otherDocuments.urls,
        }));
        setUploadedFileNames((prev) => ({
          ...prev,
          otherBusinessDocumentsFile: otherDocuments.names,
        }));
        setUploadedFileTypes((prev) => ({
          ...prev,
          otherBusinessDocumentsFile: otherDocuments.types,
        }));
        setFileUploadErrors((prev) => ({
          ...prev,
          otherBusinessDocumentsFile: "",
        }));
      } else {
        setFileUploadErrors((prev) => ({
          ...prev,
          otherBusinessDocumentsFile: otherDocumentsResult.error,
        }));
      }
    }

    loadCompanySettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setCompanyData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleGeneralSection = (sectionId) => {
    setOpenGeneralSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleAccountSection = (sectionId) => {
    setOpenAccountSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleFileUpload = async (name, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (file.size > maxCompanyFileSize) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [name]: "File must be 5 MB or smaller.",
      }));
      return;
    }

    if (!isSupportedCompanyFile(file)) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [name]: "Only images, PDFs, and Word documents are supported.",
      }));
      return;
    }

    setFileUploadErrors((prev) => ({ ...prev, [name]: "" }));
    setUploadingFiles((prev) => ({ ...prev, [name]: true }));

    const result = await uploadOrganizationSettingsFile(file);

    setUploadingFiles((prev) => ({ ...prev, [name]: false }));

    if (!result.success) {
      setFileUploadErrors((prev) => ({ ...prev, [name]: result.error }));
      return;
    }

    if (!result.url) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [name]: "File uploaded, but the server did not return a file URL.",
      }));
      return;
    }

    setUploadedFileNames((prev) => ({ ...prev, [name]: file.name }));
    setUploadedFileTypes((prev) => ({ ...prev, [name]: file.type }));
    setCompanyData((prev) => ({ ...prev, [name]: result.url }));
  };

  const handleMultipleFileUpload = async (name, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    if (files.length === 0) return;

    const oversizedFile = files.find((file) => file.size > maxCompanyFileSize);

    if (oversizedFile) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [name]: `${oversizedFile.name} must be 5 MB or smaller.`,
      }));
      return;
    }

    const unsupportedFile = files.find(
      (file) => !isSupportedOtherBusinessDocumentFile(file),
    );

    if (unsupportedFile) {
      setFileUploadErrors((prev) => ({
        ...prev,
        [name]: `${unsupportedFile.name} is not supported. Upload PDF, PNG, JPG, or DOCX files only.`,
      }));
      return;
    }

    setFileUploadErrors((prev) => ({ ...prev, [name]: "" }));
    setUploadingFiles((prev) => ({ ...prev, [name]: true }));

    const result = await uploadOrganizationOtherDocuments(files);
    setUploadingFiles((prev) => ({ ...prev, [name]: false }));

    if (!result.success) {
      setFileUploadErrors((prev) => ({ ...prev, [name]: result.error }));
      return;
    }

    const otherDocuments = buildOtherDocumentsFieldState(result.documents);

    setUploadedFileNames((prev) => ({ ...prev, [name]: otherDocuments.names }));
    setUploadedFileTypes((prev) => ({ ...prev, [name]: otherDocuments.types }));
    setCompanyData((prev) => ({ ...prev, [name]: otherDocuments.urls }));
  };

  const handleLogoFileSelect = (name, e) => {
    void name;
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setLogoUploadError("Please select an image file for the company logo.");
      return;
    }

    setLogoUploadError("");

    const reader = new FileReader();
    reader.onload = () => {
      setPendingLogoFile(file);
      setPendingLogoPreview(reader.result || "");
    };
    reader.readAsDataURL(file);
  };

  const clearPendingLogo = () => {
    setPendingLogoFile(null);
    setPendingLogoPreview("");
    setLogoUploadError("");
  };

  const handleSignatureFileSelect = (name, e) => {
    void name;
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setSignatureUploadError(
        "Please select an image file for the company signature.",
      );
      return;
    }

    setSignatureUploadError("");

    const reader = new FileReader();
    reader.onload = () => {
      setPendingSignatureFile(file);
      setPendingSignaturePreview(reader.result || "");
    };
    reader.readAsDataURL(file);
  };

  const clearPendingSignature = () => {
    setPendingSignatureFile(null);
    setPendingSignaturePreview("");
    setSignatureUploadError("");
  };

  const handleRemoveFile = (name) => {
    setCompanyData((prev) => ({ ...prev, [name]: "" }));
    setUploadedFileNames((prev) => ({ ...prev, [name]: "" }));
    setUploadedFileTypes((prev) => ({ ...prev, [name]: "" }));
    setFileUploadErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRemoveOtherBusinessDocuments = async (name) => {
    setFileUploadErrors((prev) => ({ ...prev, [name]: "" }));
    setUploadingFiles((prev) => ({ ...prev, [name]: true }));

    const result = await clearOrganizationOtherDocuments();

    setUploadingFiles((prev) => ({ ...prev, [name]: false }));

    if (!result.success) {
      setFileUploadErrors((prev) => ({ ...prev, [name]: result.error }));
      return;
    }

    handleRemoveFile(name);
    showToast({
      title: "Documents removed",
      message: "Other business documents removed successfully.",
    });
  };

  const handleRemoveLogo = (name) => {
    if (pendingLogoFile) {
      clearPendingLogo();
      return;
    }

    handleRemoveFile(name);
  };

  const handleRemoveSignature = (name) => {
    if (pendingSignatureFile) {
      clearPendingSignature();
      return;
    }

    handleRemoveFile(name);
  };

  const handleEditProfile = () => {
    if (!isEditableSection) return;
    setEditingSections((prev) => ({ ...prev, [activeTab]: true }));
  };

  const handleCancel = () => {
    resetCompanyData();
    clearPendingLogo();
    clearPendingSignature();
    setUploadedFileNames({});
    setUploadedFileTypes({});
    setFileUploadErrors({});
    setUploadingFiles({});
    if (isEditableSection) {
      setEditingSections((prev) => ({ ...prev, [activeTab]: false }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");
    setLogoUploadError("");
    setSignatureUploadError("");

    let result;
    let nextUser = loadedUser;
    let nextCompanyData = companyData;

    if (pendingLogoFile) {
      const logoResult = await uploadOrganizationLogo(pendingLogoFile);

      if (!logoResult.success) {
        setIsSaving(false);
        setLogoUploadError(logoResult.error);
        setSaveError(logoResult.error);
        return;
      }

      if (!logoResult.url) {
        const errorMessage =
          "Logo uploaded, but the server did not return a logo URL.";
        setIsSaving(false);
        setLogoUploadError(errorMessage);
        setSaveError(errorMessage);
        return;
      }

      nextCompanyData = { ...companyData, logoUrl: logoResult.url };
    }

    if (pendingSignatureFile) {
      const signatureResult =
        await uploadOrganizationSignature(pendingSignatureFile);

      if (!signatureResult.success) {
        setIsSaving(false);
        setSignatureUploadError(signatureResult.error);
        setSaveError(signatureResult.error);
        return;
      }

      if (!signatureResult.url) {
        const errorMessage =
          "Signature uploaded, but the server did not return a signature URL.";
        setIsSaving(false);
        setSignatureUploadError(errorMessage);
        setSaveError(errorMessage);
        return;
      }

      nextCompanyData = {
        ...nextCompanyData,
        signatureUrl: signatureResult.url,
      };
    }

    const organizationPayload =
      buildOrganizationSettingsRequest(nextCompanyData);

    if (activeTab === "account") {
      const userResult = await updateUser(currentUser.id, {
        name: companyData.ownerDirectorName.trim(),
        email: companyData.adminEmail.trim(),
        phone: companyData.mobileNumber.trim(),
      });

      if (userResult.success) {
        nextUser = userResult.user;
      }

      const organizationResult = userResult.success
        ? await updateOrganizationSettings(organizationPayload)
        : userResult;

      result = userResult.success ? organizationResult : userResult;
    } else if (isEditableSection) {
      result = await updateOrganizationSettings(organizationPayload);
    } else {
      result = { success: true };
    }

    if (!result.success) {
      setIsSaving(false);
      setSaveError(result.error);
      return;
    }

    const nextOrganization = result.organization || loadedOrganization;

    setLoadedUser(nextUser);
    setLoadedOrganization(nextOrganization);
    setCompanyData(buildCompanyDataFromProfile(nextUser, nextOrganization));
    clearPendingLogo();
    clearPendingSignature();

    setIsSaving(false);
    showToast({
      title: "Settings saved",
      message: "Company settings saved successfully.",
    });
    if (isEditableSection) {
      setEditingSections((prev) => ({ ...prev, [activeTab]: false }));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!passwordData.currentPassword.trim()) {
      setPasswordError("Current password is required.");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New password and confirm password must match.");
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
    setIsChangingPassword(false);

    if (!result.success) {
      setPasswordError(result.error);
      return;
    }

    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    showToast({
      title: "Password changed",
      message: result.detail || "Admin password updated successfully.",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-(--font-display) text-2xl font-bold tracking-tight text-neutral-900">
            Company Settings
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage your company information and workspace details.
          </p>
        </div>
      </div>

      {profileError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {profileError}
        </div>
      )}

      {saveError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <Card className="p-0">
        <div className="grid min-h-[34rem] grid-cols-1 lg:grid-cols-[17rem_1fr]">
          <aside className="border-b border-neutral-100 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.label}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-colors lg:w-full ${
                      isActive
                        ? "bg-primary-50 text-primary-700 ring-1 ring-primary-100"
                        : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="p-5 sm:p-7">
            <div className="border-b border-neutral-100 pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-(--font-display) text-xl font-semibold tracking-tight text-neutral-900">
                    {activeNavItem.label}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {activeNavItem.description}
                  </p>
                </div>
                {isEditableSection && (
                  <div className="flex flex-wrap items-center gap-2">
                    {isActiveSectionEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          loading={isSaving}
                        >
                          <Save className="size-3.5" />
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={handleEditProfile}>
                        <Pencil className="size-3.5" />
                        Edit Profile
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeTab === "account" ? (
              <section className="space-y-1.5 pb-5 pt-3">
                <CompanySection
                  number="1"
                  title="Account Details"
                  description="Company account classification and status."
                  isOpen={openAccountSections.details}
                  onToggle={() => toggleAccountSection("details")}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Legal Name"
                      name="legalName"
                      value={companyData.legalName}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <Select
                      label="Industry"
                      name="industry"
                      placeholder="Select industry"
                      value={companyData.industry}
                      options={industryOptions}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <Select
                      label="Status"
                      name="status"
                      placeholder="Select status"
                      value={companyData.status}
                      options={statusOptions}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                  </div>
                </CompanySection>

                <CompanySection
                  number="2"
                  title="Authorized Person"
                  description="Authorized representative contact and identity."
                  isOpen={openAccountSections.authorizedPerson}
                  onToggle={() => toggleAccountSection("authorizedPerson")}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Owner/Director Name"
                      name="ownerDirectorName"
                      value={companyData.ownerDirectorName}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <Select
                      label="Designation"
                      name="designation"
                      placeholder="Select designation"
                      value={companyData.designation}
                      options={designationOptions}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <Input
                      label="Mobile Number"
                      name="mobileNumber"
                      value={companyData.mobileNumber}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <Input
                      label="Email"
                      name="adminEmail"
                      type="email"
                      value={companyData.adminEmail}
                      onChange={handleChange}
                      disabled={!isAccountEditing}
                    />
                    <FileUploadField
                      label="Profile Picture"
                      name="profilePhotoUrl"
                      value={companyData.profilePhotoUrl}
                      onChange={handleFileUpload}
                      onRemove={handleRemoveFile}
                      disabled={!isAccountEditing}
                      uploadLabel="Upload Photo"
                      {...getUploadFieldState("profilePhotoUrl")}
                    />
                    <FileUploadField
                      label="Digital Signature"
                      name="digitalSignatureUrl"
                      value={companyData.digitalSignatureUrl}
                      onChange={handleFileUpload}
                      onRemove={handleRemoveFile}
                      disabled={!isAccountEditing}
                      uploadLabel="Upload Signature"
                      {...getUploadFieldState("digitalSignatureUrl")}
                    />
                  </div>
                </CompanySection>
              </section>
            ) : activeTab === "general" ? (
              <section className="space-y-1.5 pb-5 pt-3">
                <CompanySection
                  number="1"
                  title="Basic Information"
                  description="Company identity and legal registration details."
                  isOpen={openGeneralSections.basic}
                  onToggle={() => toggleGeneralSection("basic")}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Company Name"
                      name="name"
                      value={companyData.name}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Legal Name"
                      name="legalName"
                      value={companyData.legalName}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Select
                      label="Business Type"
                      name="businessType"
                      placeholder="Select business type"
                      value={companyData.businessType}
                      options={businessTypeOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Select
                      label="Industry"
                      name="industry"
                      placeholder="Select industry"
                      value={companyData.industry}
                      options={industryOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Date of Incorporation"
                      name="dateOfIncorporation"
                      type="date"
                      value={companyData.dateOfIncorporation}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="CIN/Registration Number"
                      name="cinRegistrationNumber"
                      value={companyData.cinRegistrationNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="GSTIN/PAN"
                      name="gstin"
                      value={companyData.gstin}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="PAN Number (if applicable)"
                      name="panNumber"
                      value={companyData.panNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      className="md:col-span-2"
                      label="Company Description"
                      name="companyDescription"
                      as="textarea"
                      value={companyData.companyDescription}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                  </div>
                </CompanySection>

                <CompanySection
                  number="2"
                  title="Contact Information"
                  description="Primary business contact details."
                  isOpen={openGeneralSections.contact}
                  onToggle={() => toggleGeneralSection("contact")}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Primary Mobile Number"
                      name="phone"
                      value={companyData.phone}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Alternate Mobile Number"
                      name="alternateMobileNumber"
                      value={companyData.alternateMobileNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Landline Number"
                      name="landlineNumber"
                      value={companyData.landlineNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Official Email Address"
                      name="email"
                      type="email"
                      value={companyData.email}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Website"
                      name="website"
                      value={companyData.website}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Customer Support Number"
                      name="customerSupportNumber"
                      value={companyData.customerSupportNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                  </div>
                </CompanySection>

                <CompanySection
                  number="3"
                  title="Address Information"
                  description="Registered, billing, and shipping addresses."
                  isOpen={openGeneralSections.address}
                  onToggle={() => toggleGeneralSection("address")}
                >
                  <div className="space-y-5">
                    <Input
                      label="Registered Address"
                      name="registeredAddress"
                      as="textarea"
                      value={companyData.registeredAddress}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Branch/Office Address(es)"
                      name="branchOfficeAddresses"
                      as="textarea"
                      value={companyData.branchOfficeAddresses}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Input
                        label="City"
                        name="city"
                        value={companyData.city}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                      />
                      <Select
                        label="State"
                        name="state"
                        placeholder="Select state"
                        value={companyData.state}
                        options={stateOptions}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <Select
                        label="Country"
                        name="country"
                        placeholder="Select country"
                        value={companyData.country}
                        options={countryOptions}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                      />
                      <Input
                        label="PIN/ZIP Code"
                        name="pincode"
                        value={companyData.pincode}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                      />
                    </div>
                    <CheckboxField
                      label="Billing address same as registered address"
                      name="billingAddressSameAsRegistered"
                      checked={companyData.billingAddressSameAsRegistered}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Billing Address"
                      name="billingAddress"
                      as="textarea"
                      value={
                        companyData.billingAddressSameAsRegistered
                          ? companyData.registeredAddress
                          : companyData.billingAddress
                      }
                      onChange={handleChange}
                      disabled={
                        !isActiveSectionEditing ||
                        companyData.billingAddressSameAsRegistered
                      }
                    />
                    <CheckboxField
                      label="Shipping/Warehouse address same as billing address"
                      name="shippingAddressSameAsBilling"
                      checked={companyData.shippingAddressSameAsBilling}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Shipping/Warehouse Address"
                      name="shippingAddress"
                      as="textarea"
                      value={
                        companyData.shippingAddressSameAsBilling
                          ? companyData.billingAddressSameAsRegistered
                            ? companyData.registeredAddress
                            : companyData.billingAddress
                          : companyData.shippingAddress
                      }
                      onChange={handleChange}
                      disabled={
                        !isActiveSectionEditing ||
                        companyData.shippingAddressSameAsBilling
                      }
                    />
                  </div>
                </CompanySection>
              </section>
            ) : activeTab === "branding" ? (
              <section className="pb-5 pt-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="space-y-3">
                    <FileUploadField
                      label="Company Logo"
                      name="logoUrl"
                      value={pendingLogoPreview || companyData.logoUrl}
                      onChange={handleLogoFileSelect}
                      onRemove={handleRemoveLogo}
                      disabled={
                        !isActiveSectionEditing || Boolean(companyData.logoUrl)
                      }
                      uploadLabel={
                        companyData.logoUrl ? "Logo Uploaded" : "Upload Logo"
                      }
                      required
                    />
                    {pendingLogoFile && (
                      <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {pendingLogoFile.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Logo will upload when you click Save Changes.
                        </p>
                      </div>
                    )}
                    {logoUploadError && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {logoUploadError}
                      </div>
                    )}
                  </div>
                  <FileUploadField
                    label="Company Stamp/Seal"
                    name="stampSealUrl"
                    value={companyData.stampSealUrl}
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("stampSealUrl")}
                  />
                  <div className="space-y-3">
                    <FileUploadField
                      label="Authorized Signature"
                      name="signatureUrl"
                      value={
                        pendingSignaturePreview || companyData.signatureUrl
                      }
                      onChange={handleSignatureFileSelect}
                      onRemove={handleRemoveSignature}
                      disabled={!isActiveSectionEditing}
                      uploadLabel={
                        companyData.signatureUrl
                          ? "Change Signature"
                          : "Upload Signature"
                      }
                      required
                    />
                    {pendingSignatureFile && (
                      <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {pendingSignatureFile.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Signature will upload when you click Save Changes.
                        </p>
                      </div>
                    )}
                    {signatureUploadError && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {signatureUploadError}
                      </div>
                    )}
                  </div>
                  <FileUploadField
                    label="Company Letterhead"
                    name="letterheadFile"
                    value={companyData.letterheadFile}
                    accept="application/pdf,.doc,.docx,image/*"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("letterheadFile")}
                  />
                  <FileUploadField
                    label="Company Banner"
                    name="bannerUrl"
                    value={companyData.bannerUrl}
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("bannerUrl")}
                  />
                </div>
              </section>
            ) : activeTab === "billings" ? (
              <section className="space-y-6 pb-5 pt-5">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Payment QR
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Upload a QR code for receiving payments.
                    </p>
                  </div>
                  <div>
                    <FileUploadField
                      label="Google Pay / PhonePe / Paytm QR Code"
                      name="qrCodeUrl"
                      value={companyData.qrCodeUrl}
                      accept="image/png,image/jpeg"
                      onChange={handleFileUpload}
                      onRemove={handleRemoveFile}
                      disabled={!isActiveSectionEditing}
                      required
                      {...getUploadFieldState("qrCodeUrl")}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      UPI Details
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Unified Payments Interface information.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="UPI ID"
                      name="upiId"
                      value={companyData.upiId}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Bank Account
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Account holder, bank, and IFSC information.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Bank Account Details"
                      name="bankAccountDetails"
                      value={companyData.bankAccountDetails}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="Account Holder Name"
                      name="accountHolderName"
                      value={companyData.accountHolderName}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Input
                      label="IFSC Code"
                      name="ifscCode"
                      value={companyData.ifscCode}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                    <Select
                      label="Bank Name"
                      name="bankName"
                      placeholder="Select bank"
                      value={companyData.bankName}
                      options={bankOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                    />
                  </div>
                </div>
              </section>
            ) : activeTab === "online-presence" ? (
              <section className="pb-5 pt-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Input
                    label="Facebook"
                    name="facebook"
                    value={companyData.facebook}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="Instagram"
                    name="instagram"
                    value={companyData.instagram}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="LinkedIn"
                    name="linkedin"
                    value={companyData.linkedin}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="X (Twitter)"
                    name="xTwitter"
                    value={companyData.xTwitter}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="YouTube"
                    name="youtube"
                    value={companyData.youtube}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="WhatsApp Business Number"
                    name="whatsappBusinessNumber"
                    value={companyData.whatsappBusinessNumber}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                </div>
              </section>
            ) : activeTab === "business-settings" ? (
              <section className="pb-5 pt-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Select
                    label="Financial Year"
                    name="financialYear"
                    placeholder="Select financial year"
                    value={companyData.financialYear}
                    options={financialYearOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Select
                    label="Currency"
                    name="currency"
                    placeholder="Select currency"
                    value={companyData.currency}
                    options={currencyOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Select
                    label="Time Zone"
                    name="timeZone"
                    placeholder="Select time zone"
                    value={companyData.timeZone}
                    options={timeZoneOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Select
                    label="Language"
                    name="language"
                    placeholder="Select language"
                    value={companyData.language}
                    options={languageOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Select
                    label="Tax Configuration"
                    name="taxConfiguration"
                    placeholder="Select tax configuration"
                    value={companyData.taxConfiguration}
                    options={taxConfigurationOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="Invoice Prefix"
                    name="invoicePrefix"
                    placeholder="e.g. INV"
                    value={companyData.invoicePrefix}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    className="md:col-span-2"
                    label="Invoice Settings"
                    name="invoiceSettings"
                    as="textarea"
                    value={companyData.invoiceSettings}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                </div>
              </section>
            ) : activeTab === "documents" ? (
              <section className="pb-5 pt-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <FileUploadField
                    label="GST Certificate"
                    name="gstCertificateFile"
                    value={companyData.gstCertificateFile}
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("gstCertificateFile")}
                  />
                  <FileUploadField
                    label="PAN Card"
                    name="panCardFile"
                    value={companyData.panCardFile}
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("panCardFile")}
                  />
                  <FileUploadField
                    label="Certificate of Incorporation"
                    name="incorporationCertificateFile"
                    value={companyData.incorporationCertificateFile}
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("incorporationCertificateFile")}
                  />
                  <FileUploadField
                    label="Trade License"
                    name="tradeLicenseFile"
                    value={companyData.tradeLicenseFile}
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("tradeLicenseFile")}
                  />
                  <FileUploadField
                    label="MSME Certificate"
                    name="msmeCertificateFile"
                    value={companyData.msmeCertificateFile}
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("msmeCertificateFile")}
                  />
                  <FileUploadField
                    label="FSSAI License"
                    name="fssaiLicenseFile"
                    value={companyData.fssaiLicenseFile}
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    onRemove={handleRemoveFile}
                    disabled={!isActiveSectionEditing}
                    {...getUploadFieldState("fssaiLicenseFile")}
                  />
                  <FileUploadField
                    label="Other Business Documents"
                    name="otherBusinessDocumentsFile"
                    value={companyData.otherBusinessDocumentsFile}
                    accept="application/pdf,image/png,image/jpeg,.docx"
                    onChange={handleMultipleFileUpload}
                    onRemove={handleRemoveOtherBusinessDocuments}
                    disabled={!isActiveSectionEditing}
                    uploadLabel="Upload Files"
                    multiple
                    {...getUploadFieldState("otherBusinessDocumentsFile")}
                  />
                </div>
              </section>
            ) : activeTab === "additional-info" ? (
              <section className="pb-5 pt-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Input
                    label="Number of Employees"
                    name="numberOfEmployees"
                    type="number"
                    value={companyData.numberOfEmployees}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    label="Business Hours"
                    name="businessHours"
                    value={companyData.businessHours}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    className="md:col-span-2"
                    label="Company Mission/Vision"
                    name="companyMissionVision"
                    as="textarea"
                    value={companyData.companyMissionVision}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                  <Input
                    className="md:col-span-2"
                    label="Notes"
                    name="notes"
                    as="textarea"
                    value={companyData.notes}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                  />
                </div>
              </section>
            ) : activeTab === "change-password" ? (
              <section className="py-6">
                <form
                  onSubmit={handleChangePassword}
                  className="max-w-2xl space-y-5"
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      className="md:col-span-2"
                      label={
                        <span>
                          Current Password{" "}
                          <span className="text-red-500">*</span>
                        </span>
                      }
                      name="currentPassword"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                    />
                    <Input
                      label="New Password"
                      name="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                    />
                    <Input
                      label="Confirm Password"
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                    />
                  </div>

                  {passwordError && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {passwordError}
                    </div>
                  )}

                  <Button type="submit" loading={isChangingPassword}>
                    <KeyRound className="size-4" />
                    Change Password
                  </Button>
                </form>
              </section>
            ) : (
              <section className="py-6">
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5">
                  <p className="text-sm font-semibold text-neutral-900">
                    {activeNavItem.label}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {activeNavItem.description}
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
