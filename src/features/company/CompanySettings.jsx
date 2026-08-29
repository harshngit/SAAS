import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BarChart3,
  Building2,
  ChevronDown,
  CheckCircle2,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  ArrowRight,
  Eye,
  FileText,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Info,
  KeyRound,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  UserRound,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Select from "../../components/ui/Select";
import { changePassword, getCurrentProfile } from "../../api/auth";
import {
  clearOrganizationOtherDocuments,
  getOrganizationOtherDocuments,
  getOrganizationOverview,
  getOrganizationSettings,
  updateOrganizationSettings,
  uploadOrganizationLogo,
  uploadOrganizationOtherDocuments,
  uploadOrganizationSettingsFile,
  uploadOrganizationSignature,
} from "../../api/organizations";
import { updateUser } from "../../api/users";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  // Match the extension against `name` and `url` separately (each own end-anchored) rather than
  // a single concatenated "name url" string - a joined string only ever end-anchors on whichever
  // value comes last, silently missing the extension on the other one.
  const nameHint = name.toLowerCase();
  const urlHint = url.toLowerCase();
  const matchesExt = (pattern) => pattern.test(nameHint) || pattern.test(urlHint);

  if (type.startsWith("image/") || matchesExt(/\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i)) {
    return "image";
  }

  if (type === "application/pdf" || matchesExt(/\.pdf(?:$|[?#])/i)) {
    return "pdf";
  }

  if (
    type === "application/msword" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    matchesExt(/\.(doc|docx)(?:$|[?#])/i)
  ) {
    return "word";
  }

  return "file";
}

// Chrome's built-in PDF viewer honors these Adobe "open parameters" as a URL hash - hides its
// own toolbar/side-panel/scrollbar chrome so an embedded PDF reads as a plain content thumbnail
// instead of a miniature scrollable viewer.
function pdfPreviewSrc(url) {
  return `${url}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&view=FitH`;
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

const dashboardDocumentFields = [
  { key: "gstCertificateFile", label: "GST Certificate" },
  { key: "panCardFile", label: "PAN Card" },
  { key: "incorporationCertificateFile", label: "Incorporation Certificate" },
  { key: "tradeLicenseFile", label: "Trade License" },
  { key: "msmeCertificateFile", label: "MSME Certificate" },
  { key: "fssaiLicenseFile", label: "FSSAI License" },
  { key: "otherBusinessDocumentsFile", label: "Other Documents" },
];

let dashboardCompletionFields = [];

function getOptionLabel(options, value, fallback = "Not set") {
  if (!value) return fallback;

  return options.find((option) => option.value === value)?.label || value;
}

function titleCase(value, fallback = "Not set") {
  if (!value) return fallback;

  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getInitials(value) {
  const words = String(value || "Company")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "CO";
}

function getStoredFileCount(value) {
  return splitStoredFiles(value).length;
}

function buildDocumentOverview(companyData) {
  return dashboardDocumentFields.map((field) => {
    const count = getStoredFileCount(companyData[field.key]);

    return {
      ...field,
      count,
      status: count > 0 ? "uploaded" : "pending",
    };
  });
}

function buildCompletionSummary(companyData) {
  const missingFields = dashboardCompletionFields.filter(
    (field) => !String(companyData[field.key] || "").trim(),
  );
  const completedCount = dashboardCompletionFields.length - missingFields.length;
  const percent = Math.round(
    (completedCount / dashboardCompletionFields.length) * 100,
  );

  return {
    percent,
    missingFields: missingFields.slice(0, 4),
  };
}

function getCompletionJumpTarget(companyData, sectionId) {
  const sectionFields = sectionId
    ? companyProfileCompletionSections.find((section) => section.id === sectionId)?.fields || []
    : companyProfileFieldConfig;

  const nextField = sectionFields.find((field) => !String(companyData[field.key] || "").trim());

  if (!nextField) return null;

  const navigation = companyProfileFieldConfigByKey[nextField.key];

  return navigation
    ? { ...navigation, fieldKey: nextField.key, fieldId: navigation.fieldId || nextField.key }
    : { tabId: "general", sectionId: "basic", fieldKey: nextField.key };
}

function getBranchCount(companyData) {
  return String(companyData.branchOfficeAddresses || "")
    .split(/\n|,/)
    .map((address) => address.trim())
    .filter(Boolean).length;
}

function getStoredFileTotal(companyData) {
  return dashboardDocumentFields.reduce(
    (total, field) => total + getStoredFileCount(companyData[field.key]),
    0,
  );
}

const editableSectionIds = [
  "general",
  "billings",
  "branding",
  "online-presence",
  "business-settings",
  "documents",
  "additional-info",
];

const companyRequiredFieldsByTab = {
  general: {
    basic: [
      { key: "name", label: "Company Name" },
      { key: "legalName", label: "Legal Name" },
      { key: "businessType", label: "Business Type" },
      { key: "industry", label: "Industry" },
      { key: "status", label: "Status" },
      { key: "cinRegistrationNumber", label: "CIN/Registration Number" },
      { key: "gstin", label: "GSTIN/PAN" },
      { key: "panNumber", label: "PAN Number" },
      { key: "companyDescription", label: "Company Description" },
    ],
    authorizedPerson: [
      { key: "ownerDirectorName", label: "Owner/Director Name" },
      { key: "designation", label: "Designation" },
      { key: "mobileNumber", label: "Mobile Number" },
      { key: "adminEmail", label: "Email" },
    ],
    contact: [
      { key: "phone", label: "Primary Mobile Number" },
      { key: "email", label: "Official Email Address" },
    ],
    address: [
      { key: "registeredAddress", label: "Registered Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
      { key: "pincode", label: "PIN/ZIP Code" },
    ],
  },
  branding: {
    main: [
      { key: "logoUrl", label: "Company Logo" },
      { key: "signatureUrl", label: "Authorized Signature" },
    ],
  },
  billings: {
    main: [
      { key: "qrCodeUrl", label: "Google Pay / PhonePe / Paytm QR Code" },
    ],
  },
  "business-settings": {
    main: [
      { key: "currency", label: "Currency" },
      { key: "timeZone", label: "Time Zone" },
      { key: "language", label: "Language" },
      { key: "taxConfiguration", label: "Tax Configuration" },
      { key: "invoiceSettings", label: "Invoice Settings" },
    ],
  },
  "additional-info": {
    main: [
      { key: "numberOfEmployees", label: "Number of Employees" },
      { key: "businessHours", label: "Business Hours" },
      { key: "companyMissionVision", label: "Company Mission/Vision" },
      { key: "notes", label: "Notes" },
    ],
  },
};

const companyCompletionNavigationMap = {
  name: { tabId: "general", sectionId: "basic" },
  legalName: { tabId: "general", sectionId: "basic" },
  businessType: { tabId: "general", sectionId: "basic" },
  industry: { tabId: "general", sectionId: "basic" },
  status: { tabId: "general", sectionId: "basic" },
  cinRegistrationNumber: { tabId: "general", sectionId: "basic" },
  gstin: { tabId: "general", sectionId: "basic" },
  panNumber: { tabId: "general", sectionId: "basic" },
  companyDescription: { tabId: "general", sectionId: "basic" },
  numberOfEmployees: { tabId: "additional-info", sectionId: null },
  businessHours: { tabId: "additional-info", sectionId: null },
  companyMissionVision: { tabId: "additional-info", sectionId: null },
  notes: { tabId: "additional-info", sectionId: null },
  ownerDirectorName: { tabId: "general", sectionId: "authorizedPerson" },
  designation: { tabId: "general", sectionId: "authorizedPerson" },
  mobileNumber: { tabId: "general", sectionId: "authorizedPerson" },
  adminEmail: { tabId: "general", sectionId: "authorizedPerson" },
  phone: { tabId: "general", sectionId: "contact" },
  email: { tabId: "general", sectionId: "contact" },
  registeredAddress: { tabId: "general", sectionId: "address" },
  city: { tabId: "general", sectionId: "address" },
  state: { tabId: "general", sectionId: "address" },
  country: { tabId: "general", sectionId: "address" },
  pincode: { tabId: "general", sectionId: "address" },
  qrCodeUrl: { tabId: "billings", sectionId: "payment" },
  upiId: { tabId: "billings", sectionId: "upi" },
  bankAccountDetails: { tabId: "billings", sectionId: "bank-account" },
  accountHolderName: { tabId: "billings", sectionId: "bank-account" },
  ifscCode: { tabId: "billings", sectionId: "bank-account" },
  bankName: { tabId: "billings", sectionId: "bank-account" },
  gstCertificateFile: { tabId: "documents", sectionId: null },
  panCardFile: { tabId: "documents", sectionId: null },
};

const companyTabSectionOrder = {
  general: ["basic", "authorizedPerson", "contact", "address"],
};

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

const companyProfileSectionRouteMap = {
  basic: { tabId: "general", route: "/admin/company-settings" },
  "authorized-person": { tabId: "general", route: "/admin/company-settings" },
  contact: { tabId: "general", route: "/admin/company-settings" },
  address: { tabId: "general", route: "/admin/company-settings" },
  branding: { tabId: "branding", route: "/admin/company-settings" },
  billings: { tabId: "billings", route: "/admin/company-settings" },
  "online-presence": { tabId: "online-presence", route: "/admin/company-settings" },
  "business-settings": { tabId: "business-settings", route: "/admin/company-settings" },
  documents: { tabId: "documents", route: "/admin/company-settings" },
  "additional-info": { tabId: "additional-info", route: "/admin/company-settings" },
};

const companyProfileCompletionSections = [
  {
    id: "basic",
    label: "Basic Information",
    description: "Company identity and legal registration details.",
    fields: [
      {
        key: "name",
        label: "Company Name",
        kind: "input",
        required: true,
      },
      {
        key: "businessType",
        label: "Business Type",
        kind: "select",
        options: businessTypeOptions,
        placeholder: "Select business type",
        required: true,
      },
      {
        key: "industry",
        label: "Industry",
        kind: "select",
        options: industryOptions,
        placeholder: "Select industry",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        kind: "select",
        options: statusOptions,
        placeholder: "Select status",
        required: true,
      },
      {
        key: "dateOfIncorporation",
        label: "Date of Incorporation",
        kind: "input",
        type: "date",
      },
      {
        key: "cinRegistrationNumber",
        label: "CIN/Registration Number",
        kind: "input",
        required: true,
      },
      {
        key: "gstin",
        label: "GSTIN/PAN",
        kind: "input",
        required: true,
      },
      {
        key: "panNumber",
        label: "PAN Number",
        kind: "input",
        required: true,
      },
      {
        key: "companyDescription",
        label: "Company Description",
        kind: "textarea",
        required: true,
      },
    ],
  },
  {
    id: "authorized-person",
    label: "Authorized Person",
    description: "Authorized representative contact and identity.",
    fields: [
      {
        key: "ownerDirectorName",
        label: "Owner/Director Name",
        kind: "input",
        required: true,
      },
      {
        key: "designation",
        label: "Designation",
        kind: "select",
        options: designationOptions,
        placeholder: "Select designation",
        required: true,
      },
      {
        key: "mobileNumber",
        label: "Mobile Number",
        kind: "input",
        required: true,
      },
      {
        key: "adminEmail",
        label: "Email",
        kind: "input",
        type: "email",
        required: true,
      },
      {
        key: "profilePhotoUrl",
        label: "Profile Picture",
        kind: "file",
        accept: "image/*",
        uploadLabel: "Upload Photo",
      },
      {
        key: "digitalSignatureUrl",
        label: "Digital Signature",
        kind: "file",
        accept: "image/*",
        uploadLabel: "Upload Signature",
      },
    ],
  },
  {
    id: "contact",
    label: "Contact Information",
    description: "Primary business contact details.",
    fields: [
      {
        key: "phone",
        label: "Primary Mobile Number",
        kind: "input",
        required: true,
      },
      {
        key: "alternateMobileNumber",
        label: "Alternate Mobile Number",
        kind: "input",
      },
      {
        key: "landlineNumber",
        label: "Landline Number",
        kind: "input",
      },
      {
        key: "email",
        label: "Official Email Address",
        kind: "input",
        type: "email",
        required: true,
      },
      {
        key: "website",
        label: "Website",
        kind: "input",
      },
      {
        key: "customerSupportNumber",
        label: "Customer Support Number",
        kind: "input",
      },
    ],
  },
  {
    id: "address",
    label: "Address Information",
    description: "Registered and operational addresses.",
    fields: [
      {
        key: "registeredAddress",
        label: "Registered Address",
        kind: "textarea",
        required: true,
      },
      {
        key: "branchOfficeAddresses",
        label: "Branch/Office Address(es)",
        kind: "textarea",
      },
      {
        key: "city",
        label: "City",
        kind: "input",
        required: true,
      },
      {
        key: "state",
        label: "State",
        kind: "select",
        options: stateOptions,
        placeholder: "Select state",
        required: true,
      },
      {
        key: "country",
        label: "Country",
        kind: "select",
        options: countryOptions,
        placeholder: "Select country",
        required: true,
      },
      {
        key: "pincode",
        label: "PIN/ZIP Code",
        kind: "input",
        required: true,
      },
    ],
  },
  {
    id: "branding",
    label: "Branding & Identity",
    description: "Visual branding and signature assets.",
    fields: [
      {
        key: "logoUrl",
        label: "Company Logo",
        kind: "file",
        accept: "image/*",
        uploadLabel: "Upload Logo",
        required: true,
      },
      {
        key: "stampSealUrl",
        label: "Company Stamp/Seal",
        kind: "file",
        accept: "image/*",
      },
      {
        key: "signatureUrl",
        label: "Authorized Signature",
        kind: "file",
        accept: "image/*",
      },
      {
        key: "letterheadFile",
        label: "Company Letterhead",
        kind: "file",
        accept: "application/pdf,.doc,.docx,image/*",
      },
      {
        key: "bannerUrl",
        label: "Company Banner",
        kind: "file",
        accept: "image/*",
      },
    ],
  },
  {
    id: "billings",
    label: "Billings",
    description: "Payment and bank details.",
    fields: [
      {
        key: "qrCodeUrl",
        label: "Google Pay / PhonePe / Paytm QR Code",
        kind: "file",
        accept: "image/png,image/jpeg",
      },
      {
        key: "upiId",
        label: "UPI ID",
        kind: "input",
      },
      {
        key: "bankAccountDetails",
        label: "Bank Account Details",
        kind: "input",
      },
      {
        key: "accountHolderName",
        label: "Account Holder Name",
        kind: "input",
      },
      {
        key: "ifscCode",
        label: "IFSC Code",
        kind: "input",
      },
      {
        key: "bankName",
        label: "Bank Name",
        kind: "select",
        options: bankOptions,
        placeholder: "Select bank",
      },
    ],
  },
  {
    id: "online-presence",
    label: "Online Presence",
    description: "Social and online business profiles.",
    fields: [
      { key: "facebook", label: "Facebook", kind: "input" },
      { key: "instagram", label: "Instagram", kind: "input" },
      { key: "linkedin", label: "LinkedIn", kind: "input" },
      { key: "xTwitter", label: "X (Twitter)", kind: "input" },
      { key: "youtube", label: "YouTube", kind: "input" },
      {
        key: "whatsappBusinessNumber",
        label: "WhatsApp Business Number",
        kind: "input",
      },
    ],
  },
  {
    id: "business-settings",
    label: "Business Settings",
    description: "Accounting, tax, and localization settings.",
    fields: [
      {
        key: "financialYear",
        label: "Financial Year",
        kind: "select",
        options: financialYearOptions,
        placeholder: "Select financial year",
      },
      {
        key: "currency",
        label: "Currency",
        kind: "select",
        options: currencyOptions,
        placeholder: "Select currency",
      },
      {
        key: "timeZone",
        label: "Time Zone",
        kind: "select",
        options: timeZoneOptions,
        placeholder: "Select time zone",
      },
      {
        key: "language",
        label: "Language",
        kind: "select",
        options: languageOptions,
        placeholder: "Select language",
      },
      {
        key: "taxConfiguration",
        label: "Tax Configuration",
        kind: "select",
        options: taxConfigurationOptions,
        placeholder: "Select tax configuration",
      },
      {
        key: "invoicePrefix",
        label: "Invoice Prefix",
        kind: "input",
      },
      {
        key: "invoiceSettings",
        label: "Invoice Settings",
        kind: "textarea",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    description: "Compliance and registration documents.",
    fields: [
      {
        key: "gstCertificateFile",
        label: "GST Certificate",
        kind: "file",
        accept: "application/pdf,image/*",
      },
      {
        key: "panCardFile",
        label: "PAN Card",
        kind: "file",
        accept: "application/pdf,image/*",
      },
      {
        key: "incorporationCertificateFile",
        label: "Certificate of Incorporation",
        kind: "file",
        accept: "application/pdf",
      },
      {
        key: "tradeLicenseFile",
        label: "Trade License",
        kind: "file",
        accept: "application/pdf,image/*",
      },
      {
        key: "msmeCertificateFile",
        label: "MSME Certificate",
        kind: "file",
        accept: "application/pdf",
      },
      {
        key: "fssaiLicenseFile",
        label: "FSSAI License",
        kind: "file",
        accept: "application/pdf,image/*",
      },
      {
        key: "otherBusinessDocumentsFile",
        label: "Other Business Documents",
        kind: "file",
        accept: "application/pdf,image/png,image/jpeg,.docx",
      },
    ],
  },
  {
    id: "additional-info",
    label: "Additional Information",
    description: "Operational details and internal notes.",
    fields: [
      {
        key: "numberOfEmployees",
        label: "Number of Employees",
        kind: "input",
      },
      {
        key: "businessHours",
        label: "Business Hours",
        kind: "input",
      },
      {
        key: "companyMissionVision",
        label: "Company Mission/Vision",
        kind: "textarea",
      },
      {
        key: "notes",
        label: "Notes",
        kind: "textarea",
      },
    ],
  },
];

const companyProfileFieldConfig = companyProfileCompletionSections.flatMap((section) => {
  const routeInfo = companyProfileSectionRouteMap[section.id] || {
    tabId: section.id,
    route: "/admin/company-settings",
  };

  return section.fields.map((field) => ({
    key: field.key,
    label: field.label,
    required: field.required !== false,
    section: section.id,
    sectionLabel: section.label,
    tabId: routeInfo.tabId,
    route: routeInfo.route,
    fieldId: field.fieldId || field.key,
  }));
});

const companyProfileFieldConfigByKey = Object.fromEntries(
  companyProfileFieldConfig.map((field) => [field.key, field]),
);

dashboardCompletionFields = companyProfileFieldConfig;

function isBlankCompanyValue(value) {
  return String(value ?? "").trim().length === 0;
}

function getCompanyProfileCompletionState(companyData) {
  const sections = companyProfileCompletionSections.map((section) => {
    const fields = section.fields.map((field) => {
      const metadata = companyProfileFieldConfigByKey[field.key] || field;
      const value = companyData?.[field.key];
      const completed = !isBlankCompanyValue(value);

      return {
        ...metadata,
        value,
        completed,
      };
    });

    const completedFields = fields.filter((field) => field.completed).length;
    const totalFields = fields.length;

    return {
      ...section,
      fields,
      completedFields,
      totalFields,
      incompleteFields: fields.filter((field) => !field.completed),
      isComplete: completedFields === totalFields,
    };
  });

  const completedRequiredFields = sections.reduce(
    (total, section) => total + section.completedFields,
    0,
  );
  const totalRequiredFields = sections.reduce(
    (total, section) => total + section.totalFields,
    0,
  );

  return {
    sections,
    completedRequiredFields,
    totalRequiredFields,
    percent:
      totalRequiredFields === 0
        ? 0
        : Math.round((completedRequiredFields / totalRequiredFields) * 100),
    missingFields: sections.flatMap((section) =>
      section.incompleteFields.map((field) => ({
        ...field,
        sectionId: section.id,
        sectionLabel: section.label,
      })),
    ),
    firstIncompleteSection:
      sections.find((section) => !section.isComplete) || sections[0] || null,
  };
}

function getCompletionSectionFields(section, companyData) {
  return section.fields.filter((field) => isBlankCompanyValue(companyData?.[field.key]));
}

function getCompletionValidationError(field, value) {
  const trimmedValue = String(value ?? "").trim();

  if (!trimmedValue) {
    return `${field.label} is required.`;
  }

  if (field.key === "email") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(trimmedValue) ? "" : "Enter a valid email address.";
  }

  if (field.key === "phone") {
    const phonePattern = /^\+?[0-9][0-9\s()-]{7,}$/;
    return phonePattern.test(trimmedValue)
      ? ""
      : "Enter a valid contact number.";
  }

  if (field.key === "gstin") {
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    return gstPattern.test(trimmedValue)
      ? ""
      : "Enter a valid GST number.";
  }

  if (field.key === "panNumber") {
    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    return panPattern.test(trimmedValue)
      ? ""
      : "Enter a valid PAN number.";
  }

  if (field.key === "pincode") {
    const pinPattern = /^[1-9][0-9]{5}$/;
    return pinPattern.test(trimmedValue) ? "" : "Enter a valid PIN code.";
  }

  return "";
}

function getCompletionFieldApiKey(fieldKey) {
  const apiKeys = {
    logoUrl: "logo_url",
    name: "name",
    businessType: "business_type",
    gstin: "gst_number",
    panNumber: "pan_number",
    phone: "phone",
    email: "email",
    registeredAddress: "address",
    city: "city",
    state: "state",
    pincode: "pin_code",
    bankAccountDetails: "bank_account_details",
    accountHolderName: "bank_account_holder",
    ifscCode: "bank_ifsc",
    bankName: "bank_name",
  };

  return apiKeys[fieldKey] || fieldKey;
}

function getCompletionFieldKeyFromApiKey(apiKey) {
  const fieldKeys = {
    logo_url: "logoUrl",
    name: "name",
    business_type: "businessType",
    gst_number: "gstin",
    pan_number: "panNumber",
    phone: "phone",
    email: "email",
    address: "registeredAddress",
    city: "city",
    state: "state",
    pin_code: "pincode",
    bank_account_details: "bankAccountDetails",
    bank_account_holder: "accountHolderName",
    bank_ifsc: "ifscCode",
    bank_name: "bankName",
  };

  return fieldKeys[apiKey] || apiKey;
}

function CompanyProfileCompletionModal({
  isOpen,
  companyData,
  onClose,
  onCompleteNow,
  initialSectionId,
}) {
  const completion = useMemo(
    () => getCompanyProfileCompletionState(companyData),
    [companyData],
  );
  const incompleteSections = useMemo(() => {
    const sections = completion.sections.filter((section) => !section.isComplete);

    if (!initialSectionId) {
      return sections;
    }

    return [...sections].sort((left, right) => {
      if (left.id === initialSectionId) return -1;
      if (right.id === initialSectionId) return 1;
      return 0;
    });
  }, [completion.sections, initialSectionId]);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const handleCompleteSection = (sectionId) => {
    if (typeof onCompleteNow === "function") {
      onCompleteNow(sectionId);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Company Profile Completion"
      className="!max-w-md"
    >
      <div className="max-h-[65vh] overflow-y-auto pr-1">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(rgb(22 101 52) ${completion.percent}%, rgb(229 231 235) 0)`,
              }}
            >
              <div className="grid size-6.5 place-items-center rounded-full bg-white text-[0.62rem] font-bold text-neutral-900">
                {completion.percent}%
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-neutral-900">
                {completion.completedRequiredFields} of {completion.totalRequiredFields} required fields completed
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2.5 space-y-2">
          {incompleteSections.length > 0 ? (
            incompleteSections.map((section) => {
              const missingSummary = section.incompleteFields.map((field) => field.label);

              return (
                <article
                  key={section.id}
                  className="rounded-lg border border-neutral-100 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-neutral-900">
                        {section.label}
                      </h4>
                      <p className="mt-0.5 text-[0.7rem] text-neutral-500">
                        {section.incompleteFields.length} required field
                        {section.incompleteFields.length === 1 ? "" : "s"} is missing
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[0.62rem] font-semibold text-amber-700">
                      Incomplete
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1 text-[0.66rem] text-neutral-600">
                    {missingSummary.map((fieldLabel) => (
                      <span
                        key={fieldLabel}
                        className="inline-flex items-center rounded-full bg-neutral-50 px-1.5 py-0.5 font-medium text-neutral-700"
                      >
                        {fieldLabel}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCompleteSection(section.id)}
                      className="whitespace-nowrap text-xs"
                    >
                      Complete Now
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 p-3 text-xs text-neutral-500">
              All profile sections are complete.
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-[0.7rem] text-neutral-600">
          <Info className="size-3.5 shrink-0 text-emerald-700" />
          <span>You&apos;ll be taken directly to the first missing field in the selected section.</span>
        </div>
      </div>

      <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

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

// Small thumbnail strip for a multi-file field's extra files (beyond the primary one shown in
// the big box) - mirrors the "Other Documents" strip used on the Customer form so multi-file
// uploads look consistent across the app instead of just listing raw filenames.
function MiniFilePreviewStrip({ files = [] }) {
  if (!files.length) return null;

  const visibleFiles = files.slice(0, 2);
  const remainingCount = files.length - visibleFiles.length;

  return (
    <div className="mt-2 flex min-w-0 items-center gap-2">
      {visibleFiles.map((file) => (
        <a
          key={`${file.name}-${file.url}`}
          href={file.url}
          target="_blank"
          rel="noreferrer"
          title={file.name}
          className="group relative flex size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
        >
          {file.kind === "image" ? (
            <img src={file.url} alt={file.name} className="size-full object-cover" />
          ) : file.kind === "pdf" ? (
            <iframe
              src={pdfPreviewSrc(file.url)}
              title={file.name}
              scrolling="no"
              className="h-full w-[calc(100%+20px)] -mr-5 pointer-events-none border-0 bg-white"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-neutral-500">
              <FileText className="size-5" aria-hidden="true" />
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {file.name}
          </span>
        </a>
      ))}
      {remainingCount > 0 && (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-xs font-semibold text-neutral-500">
          +{remainingCount}
        </span>
      )}
    </div>
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
    multiple && previewFiles.length > 0
      ? `${previewFiles.length} file(s)`
      : displayName || previewFiles.map((file) => file.name).join(", ");
  const extraPreviewFiles = multiple ? previewFiles.slice(1) : [];
  const handlePreview = () => {
    if (!canPreview) return;

    if (onPreview) {
      onPreview({ label, files: previewFiles });
      return;
    }

    openFileInNewTab(previewFiles[0]?.url);
  };
  const isPdfPreview = !isImagePreview && previewFiles[0]?.kind === "pdf";
  const previewContent = isImagePreview ? (
    <img
      src={value}
      alt={`${label} preview`}
      className="max-h-16 max-w-32 object-contain"
    />
  ) : isPdfPreview ? (
    <iframe
      src={pdfPreviewSrc(previewFiles[0].url)}
      title={`${label} preview`}
      scrolling="no"
      className="h-full w-[calc(100%+20px)] -mr-5 pointer-events-none border-0 bg-white"
    />
  ) : canPreview ? (
    <FileText className="size-6 text-neutral-500" aria-hidden="true" />
  ) : (
    <Upload className="size-6 text-neutral-400" aria-hidden="true" />
  );

  return (
    <div
      id={name}
      data-profile-field={name}
      className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4"
    >
      <div className="grid grid-cols-[9rem_1fr] gap-4">
        {canPreview ? (
          <button
            type="button"
            onClick={handlePreview}
            className="flex h-20 w-36 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white text-xs font-medium text-neutral-400 transition-colors hover:border-primary-300 hover:bg-primary-50/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
          {!uploading && <MiniFilePreviewStrip files={extraPreviewFiles} />}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {canPreview && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreview}
              >
                <Eye className="size-4" />
                Preview
              </Button>
            )}
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
                name={name}
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
  sectionId,
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
      data-section-id={sectionId}
      data-completion-section={sectionId ? `general-${sectionId}` : undefined}
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

const activityIconByType = {
  company_profile: CheckCircle2,
  billing: CreditCard,
  authorized_person: CircleUserRound,
  address: MapPin,
  branding: ImageIcon,
  online_presence: Globe,
  document: FileText,
  employee: Users,
};

const activityToneByType = {
  company_profile: "green",
  billing: "blue",
  authorized_person: "sky",
  address: "orange",
  branding: "violet",
  online_presence: "blue",
  document: "amber",
  employee: "green",
};

function formatActivityTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Sourced from GET /organizations/overview (see api/organizations.js#getOrganizationOverview) -
// falls back to the locally-derived values only for fields the endpoint's response doesn't cover.
function CompanyOverviewDashboard({
  overview,
  isLoading,
  error,
  onRetry,
  companyData,
  organization,
  onNavigate,
  onOpenAuthorizedPersonSection,
  completionState,
  onViewAllCompletion,
  onCompleteNow,
}) {
  if (isLoading) {
    return (
      <section className="pb-5">
        <LoadingSpinner label="Loading company overview..." />
      </section>
    );
  }

  if (error) {
    return (
      <section className="pb-5">
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const company = overview?.company || {};
  const counts = overview?.counts || {};
  const storage = overview?.storage || {};
  const authorizedPersonBlock = overview?.authorized_person || {};
  const documentsBlock = overview?.documents || {};
  const addressesBlock = Array.isArray(overview?.addresses) ? overview.addresses : [];
  const recentActivityBlock = Array.isArray(overview?.recent_activity) ? overview.recent_activity : [];

  const localDocuments = buildDocumentOverview(companyData);
  const apiDocumentRows = documentsBlock.documents || documentsBlock.items || documentsBlock.rows;
  // API rows are {key, name, status, url}; the local fallback shape is {key, label, status} - normalize both to `label`.
  const documentRows = Array.isArray(apiDocumentRows)
    ? apiDocumentRows.map((document) => ({ ...document, label: document.name || document.label }))
    : localDocuments;
  const uploadedDocuments =
    documentsBlock.uploaded ?? documentRows.filter((document) => document.status === "uploaded").length;

  const localCompletion = buildCompletionSummary(companyData);
  const completion = completionState || {
    percent: localCompletion.percent,
    completedRequiredFields: dashboardCompletionFields.length - localCompletion.missingFields.length,
    totalRequiredFields: dashboardCompletionFields.length,
    missingFields: localCompletion.missingFields,
    firstIncompleteSection: null,
    sections: [],
  };

  const branchCount = counts.branches ?? getBranchCount(companyData);
  const companyName = company.legal_name || company.name || companyData.legalName || companyData.name || "Company";
  const displayName = company.name || companyName;
  const statusValue = company.company_status || companyData.status;
  const statusLabel = titleCase(statusValue, "Active");
  const statusIsActive = String(statusValue || "active").toLowerCase() === "active";
  const companyCode =
    company.company_code || (organization?.id ? `CMP-${String(organization.id).padStart(5, "0")}` : "Not set");
  const employeeCount = counts.employees ?? companyData.numberOfEmployees ?? 0;
  const activeUsers = counts.active_users ?? 0;
  const registrationDate = company.registration_date || companyData.dateOfIncorporation || "";
  const formattedRegistrationDate = registrationDate
    ? new Date(registrationDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not set";
  const industryLabel = getOptionLabel(industryOptions, company.industry || companyData.industry);
  const companyTypeLabel = getOptionLabel(
    businessTypeOptions,
    company.company_type || companyData.businessType,
  );
  const planLabel = titleCase(company.plan?.name || company.plan?.plan_name || organization?.plan_name, "Not set");
  const logoUrl = company.logo || companyData.logoUrl;

  const registeredAddressEntry =
    addressesBlock.find((address) => address.is_primary) || addressesBlock[0] || null;
  const branchAddressEntry = addressesBlock.find((address) => !address.is_primary) || null;
  const addressText = (address) =>
    address?.address || address?.full_address || address?.line1 || address?.address_line1 || "";
  const addressLine = registeredAddressEntry
    ? addressText(registeredAddressEntry) || "Registered address not added."
    : companyData.registeredAddress || companyData.address || "Registered address not added.";
  const locationLine = registeredAddressEntry
    ? [registeredAddressEntry.city, registeredAddressEntry.state, registeredAddressEntry.country].filter(Boolean).join(", ")
    : [companyData.city, companyData.state, getOptionLabel(countryOptions, companyData.country, "")]
        .filter(Boolean)
        .join(", ");
  const branchAddress = branchAddressEntry
    ? addressText(branchAddressEntry) || "Branch or warehouse address not added."
    : companyData.branchOfficeAddresses || companyData.billingAddress || "Branch or warehouse address not added.";

  const authorizedDesignation = getOptionLabel(
    designationOptions,
    authorizedPersonBlock.designation || companyData.designation,
    titleCase(authorizedPersonBlock.designation || companyData.designation, "Not set"),
  );
  const authorizedName = authorizedPersonBlock.name || companyData.ownerDirectorName || companyData.adminName;
  const authorizedEmail = authorizedPersonBlock.email || companyData.adminEmail || companyData.email;
  const authorizedMobile = authorizedPersonBlock.mobile || companyData.mobileNumber || companyData.phone;
  const authorizedPhoto = authorizedPersonBlock.photo || companyData.profilePhotoUrl;
  const authorizedIsComplete = authorizedPersonBlock.is_complete ?? Boolean(authorizedName && authorizedEmail);

  const storageLabel = storage.files != null
    ? `${storage.files} files`
    : `${getStoredFileTotal(companyData)} files`;

  const metricCards = [
    {
      label: "Employees",
      value: employeeCount || "0",
      caption: "Total Employees",
      icon: Users,
      tone: "green",
    },
    {
      label: "Branches",
      value: branchCount || "0",
      caption: "Total Branches",
      icon: Building2,
      tone: "orange",
    },
    {
      label: "Active Users",
      value: activeUsers || "0",
      caption: "System Users",
      icon: CircleUserRound,
      tone: "sky",
    },
    {
      label: "Documents",
      value: uploadedDocuments,
      caption: "Uploaded Files",
      icon: FileText,
      tone: "amber",
    },
    {
      label: "Storage Used",
      value: storageLabel,
      caption: storage.percent_used != null ? `${storage.percent_used}% of plan limit` : "Company Documents",
      icon: HardDrive,
      tone: "violet",
    },
  ];
  const recentActivity = recentActivityBlock.length > 0
    ? recentActivityBlock.map((activity, index) => ({
        title: activity.title || "Update",
        caption: activity.description || activity.by || "",
        icon: activityIconByType[activity.type] || CheckCircle2,
        tone: activityToneByType[activity.type] || "green",
        time: formatActivityTime(activity.at) || (index === 0 ? "Today" : "Recent"),
      }))
    : [
        {
          title: "No recent activity yet",
          caption: "Changes to your company profile will show up here.",
          icon: CheckCircle2,
          tone: "green",
          time: "",
        },
      ];
  const quickActions = [
    { label: "Edit Profile", icon: Pencil, tab: "general", tone: "green" },
    { label: "Upload Document", icon: UploadCloud, tab: "documents", tone: "blue" },
    { label: "Invite User", icon: UserPlus, tab: "additional-info", tone: "violet" },
    { label: "View Reports", icon: BarChart3, tab: "business-settings", tone: "orange" },
  ];
  const companyFacts = [
    { label: "Company Code", value: companyCode },
    { label: "Industry", value: industryLabel },
    { label: "Company Type", value: companyTypeLabel },
    { label: "Registration Date", value: formattedRegistrationDate, icon: CheckCircle2 },
    { label: "Plan", value: planLabel },
  ];
  const toneClasses = {
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <section className="space-y-4 pb-5">
      <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex shrink-0 items-center gap-5 xl:w-[22rem]">
            <div className="grid size-28 shrink-0 place-items-center rounded-full border border-neutral-100 bg-white text-2xl font-bold text-primary-700 shadow-sm">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${displayName} logo`}
                  className="size-24 rounded-full object-contain"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-neutral-900">
                  {companyName}
                </h2>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    statusIsActive
                      ? "bg-green-50 text-green-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">
                {companyData.companyDescription ||
                  "Company profile and organization information."}
              </p>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1.15fr_1.35fr_1fr]">
            {companyFacts.map((fact, index) => {
              const Icon = fact.icon;

              return (
                <div
                  key={`${fact.label}-${index}`}
                  className="min-w-0 border-neutral-100 px-0 sm:px-4 sm:[&:not(:first-child)]:border-l"
                >
                  <p className="whitespace-nowrap text-xs font-medium text-neutral-500">
                    {fact.label}
                  </p>
                  <p
                    className="mt-2 flex min-w-0 items-center gap-2 truncate font-semibold text-neutral-900"
                    title={String(fact.value)}
                  >
                    {Icon && <Icon className="size-4 shrink-0 text-neutral-500" />}
                    <span className="truncate">{fact.value}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((metric, index) => {
          const Icon = metric.icon;

          return (
            <div
              key={`${metric.label}-${index}`}
              className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className={`flex size-12 items-center justify-center rounded-full ${toneClasses[metric.tone]}`}>
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-neutral-500">
                    {metric.label}
                  </p>
                  <p className="text-xl font-bold text-neutral-900">
                    {metric.value}
                  </p>
                  <p className="text-xs text-neutral-500">{metric.caption}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex h-full flex-col rounded-[1.15rem] border border-neutral-100 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_30px_-20px_rgba(15,23,42,0.35)]">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-900 shadow-[0_0_0_1px_rgba(6,95,70,0.08)]">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">
                Profile Completion
              </h3>
              <p className="mt-1 max-w-xl text-xs leading-4 text-slate-500">
                Complete the missing information to finish your company profile.
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-950 via-primary-700 to-primary-600 transition-all duration-300"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold tracking-tight text-slate-950">
              {completion.percent}% Complete
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {completion.completedRequiredFields} of {completion.totalRequiredFields} required fields completed
            </p>
          </div>
          <div className="mt-3">
            {completion.percent >= 100 ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-800">
                Profile Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-800">
                <span className="size-1.5 rounded-full bg-amber-500" />
                {Math.max(completion.totalRequiredFields - completion.completedRequiredFields, 0)} fields remaining
              </span>
            )}
          </div>
          <div className="mt-auto pt-4">
            <Button
              type="button"
              size="sm"
              onClick={onViewAllCompletion}
              className="w-full justify-center py-2 text-xs font-semibold shadow-[0_16px_30px_-18px_rgba(6,95,70,0.8)]"
            >
              View Missing Fields
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              Authorized Person
            </h3>
            {authorizedIsComplete && (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                <ShieldCheck className="size-3.5" />
                Verified
              </span>
            )}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-600">
              {authorizedPhoto ? (
                <img
                  src={authorizedPhoto}
                  alt={authorizedName || "Authorized person"}
                  className="size-16 rounded-full object-cover"
                />
              ) : (
                getInitials(authorizedName)
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-neutral-900">
                {authorizedName || "Not set"}
              </p>
              <p className="text-sm text-neutral-500">{authorizedDesignation}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                <Mail className="size-3.5" />
                {authorizedEmail || "Email not set"}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                <Phone className="size-3.5" />
                {authorizedMobile || "Phone not set"}
              </p>
            </div>
          </div>
          <div className="mt-22 grid grid-cols-2 gap-3">
            <Button type="button" size="sm" variant="outline" onClick={onOpenAuthorizedPersonSection}>
              View Details
            </Button>
            <Button type="button" size="sm" onClick={onOpenAuthorizedPersonSection}>
              Edit
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Documents Overview
            </h3>
            <ClipboardList className="size-4 text-neutral-400" />
          </div>
          <div className="mt-4 space-y-3">
            {documentRows.slice(0, 5).map((document) => (
              <div key={document.key} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-neutral-500" />
                  <span className="truncate text-sm text-neutral-700">
                    {document.label}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    document.status === "uploaded"
                      ? "text-green-700"
                      : "text-amber-600"
                  }`}
                >
                  {document.status === "uploaded" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <XCircle className="size-3.5" />
                  )}
                  {document.status === "uploaded" ? "Uploaded" : "Pending"}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("documents")}
            className="mt-5 w-full border-t border-neutral-100 pt-4 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            View All Documents
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-neutral-500" />
              <h3 className="text-sm font-semibold text-neutral-900">
                Company Addresses
              </h3>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_14rem]">
              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-primary-700">
                      Registered Office
                    </p>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      Primary
                    </span>
                  </div>
                  <p className="mt-2 text-neutral-700">{addressLine}</p>
                  {locationLine && (
                    <p className="mt-1 text-neutral-500">{locationLine}</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-blue-700">
                    Branch/Warehouse Address
                  </p>
                  <p className="mt-2 text-neutral-700">{branchAddress}</p>
                </div>
              </div>
              <div className="relative min-h-36 overflow-hidden rounded-xl border border-neutral-100 bg-[linear-gradient(135deg,#e8f3ff_25%,transparent_25%),linear-gradient(225deg,#e8f3ff_25%,transparent_25%),linear-gradient(45deg,#edf7ef_25%,transparent_25%),linear-gradient(315deg,#edf7ef_25%,#f8fafc_25%)] bg-[length:36px_36px]">
                <div className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red-500 text-white shadow-lg">
                  <MapPin className="size-5" />
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate("general")}
                  className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 shadow-sm ring-1 ring-neutral-100"
                >
                  View on Map
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Recent Activity
              </h3>
              <button
                type="button"
                onClick={() => onNavigate("additional-info")}
                className="text-xs font-semibold text-primary-700"
              >
                View All
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;

                return (
                  <div key={`${activity.title}-${index}`} className="flex gap-3">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${toneClasses[activity.tone]}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-neutral-900">
                          {activity.title}
                        </p>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {activity.time}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">{activity.caption}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="self-start rounded-xl border border-neutral-100 bg-white p-4 shadow-sm h-[208px]">
          <h3 className="text-sm font-semibold text-neutral-900">
            Quick Actions
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {quickActions.map((action, index) => {
              const Icon = action.icon;

              return (
                <button
                  key={`${action.label}-${index}`}
                  type="button"
                  onClick={() => onNavigate(action.tab)}
                  className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-xl border border-neutral-100 bg-white px-1.5 py-2 text-center text-[10px] font-semibold leading-tight text-neutral-700 transition-colors hover:border-primary-100 hover:bg-primary-50/40"
                >
                  <span className={`flex size-7 items-center justify-center rounded-lg ${toneClasses[action.tone]}`}>
                    <Icon className="size-3.5" />
                  </span>
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
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
      "",
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
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
  const [overview, setOverview] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState("");
  const [activeTab, setActiveTab] = useState("account");
  const [editingSections, setEditingSections] = useState({
    general: false,
  });
  const [openGeneralSections, setOpenGeneralSections] = useState({
    basic: true,
    authorizedPerson: false,
    contact: false,
    address: false,
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
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completionModalSectionId, setCompletionModalSectionId] = useState("");
  const [pendingGeneralSectionScroll, setPendingGeneralSectionScroll] =
    useState("");
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
  const handledCompletionNavigationRef = useRef("");
  const handleTabChangeRef = useRef(handleTabChange);
  const isEditableSection = editableSectionIds.includes(activeTab);
  const isActiveSectionEditing = Boolean(editingSections[activeTab]);
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

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    setOverviewError("");

    const result = await getOrganizationOverview();

    setIsLoadingOverview(false);

    if (!result.success) {
      setOverviewError(result.error);
      return;
    }

    setOverview(result.overview);
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const completionNavigationSection = searchParams.get("section") || "";
  const completionNavigationField = searchParams.get("field") || "";
  const completionNavigationTarget = useMemo(() => {
    if (!completionNavigationField) return null;

    return companyProfileFieldConfigByKey[completionNavigationField] || null;
  }, [completionNavigationField]);

  useEffect(() => {
    if (!completionNavigationTarget || !completionNavigationSection) return;

    const handledNavigationKey = `${location.key}:${completionNavigationSection}:${completionNavigationField}`;

    if (handledCompletionNavigationRef.current === handledNavigationKey) {
      return;
    }

    if (activeTab !== completionNavigationTarget.tabId) {
      handleTabChangeRef.current(completionNavigationTarget.tabId, {
        force: true,
      });
      return;
    }

    if (
      completionNavigationTarget.tabId === "general" &&
      completionNavigationTarget.section &&
      !openGeneralSections[completionNavigationTarget.section]
    ) {
      setOpenGeneralSections((prev) => ({
        ...prev,
        [completionNavigationTarget.section]: true,
      }));
      return;
    }

    let cancelled = false;
    let animationFrameId = null;
    let attempt = 0;

    const focusField = () => {
      if (cancelled) return;

      const fieldElement = document.querySelector(
        `[data-profile-field="${completionNavigationTarget.fieldId}"]`,
      );

      if (!fieldElement) {
        if (attempt < 20) {
          attempt += 1;
          animationFrameId = window.requestAnimationFrame(focusField);
        } else {
          const fallbackSelector =
            completionNavigationTarget.tabId === "general"
              ? `[data-section-id="${completionNavigationSection}"]`
              : `[data-completion-section="${completionNavigationTarget.tabId}-main"]`;

          document
            .querySelector(fallbackSelector)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          handledCompletionNavigationRef.current = handledNavigationKey;
        }
        return;
      }

      fieldElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      const focusable =
        fieldElement.querySelector(
          'input:not([type="hidden"]), textarea, [role="button"], [role="combobox"], button, select',
        ) ||
        fieldElement.querySelector(
          'input, textarea, [role="button"], [role="combobox"], button, select',
        );

      focusable?.focus?.();
      const previousBoxShadow = fieldElement.style.boxShadow;
      const previousTransition = fieldElement.style.transition;
      const previousBorderColor = fieldElement.style.borderColor;

      fieldElement.style.transition = "box-shadow 200ms ease, border-color 200ms ease";
      fieldElement.style.boxShadow = "0 0 0 1px rgba(6, 59, 0, 0.14), 0 0 0 6px rgba(6, 95, 70, 0.08)";
      fieldElement.style.borderColor = "rgba(6, 95, 70, 0.4)";

      window.setTimeout(() => {
        fieldElement.style.boxShadow = previousBoxShadow;
        fieldElement.style.transition = previousTransition;
        fieldElement.style.borderColor = previousBorderColor;
      }, 2000);
      handledCompletionNavigationRef.current = handledNavigationKey;
    };

    animationFrameId = window.requestAnimationFrame(focusField);

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    activeTab,
    completionNavigationField,
    completionNavigationSection,
    completionNavigationTarget,
    location.key,
    openGeneralSections,
  ]);

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
    setSaveError("");
    setCompanyData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const getRequiredCompanyValue = (key) => {
    if (key === "logoUrl") {
      return pendingLogoPreview || companyData.logoUrl;
    }

    if (key === "signatureUrl") {
      return pendingSignaturePreview || companyData.signatureUrl;
    }

    return companyData[key];
  };

  const validateCompanyRequiredFields = (tabId, sectionIds) => {
    const sections = companyRequiredFieldsByTab[tabId];

    if (!sections) {
      setSaveError("");
      return true;
    }

    const sectionsToValidate = sectionIds || Object.keys(sections);

    for (const sectionId of sectionsToValidate) {
      const missingRequiredFields = (sections[sectionId] || [])
        .filter((field) => !String(getRequiredCompanyValue(field.key) || "").trim())
        .map((field) => field.label);

      if (missingRequiredFields.length > 0) {
        if (tabId === "general") {
          setOpenGeneralSections((prev) => ({ ...prev, [sectionId]: true }));
        }

        setSaveError(`Please complete required fields: ${missingRequiredFields.join(", ")}.`);
        return false;
      }
    }

    setSaveError("");
    return true;
  };

  const toggleGeneralSection = (sectionId) => {
    const isOpeningSection = !openGeneralSections[sectionId];

    if (isOpeningSection && isActiveSectionEditing) {
      const targetSectionIndex = companyTabSectionOrder.general.indexOf(sectionId);
      const requiredPreviousSections = companyTabSectionOrder.general.slice(0, targetSectionIndex);

      if (!validateCompanyRequiredFields("general", requiredPreviousSections)) return;
    }

    setOpenGeneralSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  function handleTabChange(tabId, options = {}) {
    const { force = false } = options;

    if (
      !force &&
      activeTab !== tabId &&
      isActiveSectionEditing &&
      !validateCompanyRequiredFields(activeTab)
    ) {
      return;
    }

    setSaveError("");
    setActiveTab(tabId);
  }

  handleTabChangeRef.current = handleTabChange;

  const handleOpenAuthorizedPersonSection = () => {
    handleTabChange("general", { force: true });
    setOpenGeneralSections((prev) => ({
      ...prev,
      authorizedPerson: true,
    }));
    setPendingGeneralSectionScroll("authorized-person");
  };

  useEffect(() => {
    if (!pendingGeneralSectionScroll || activeTab !== "general") {
      return;
    }

    const sectionElement = document.querySelector(
      `[data-section-id="${pendingGeneralSectionScroll}"]`,
    );

    if (!sectionElement) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      sectionElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingGeneralSectionScroll("");
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeTab, openGeneralSections.authorizedPerson, pendingGeneralSectionScroll]);

  const handleCompleteProfileJump = useCallback((sectionId) => {
    const target = getCompletionJumpTarget(companyData, sectionId);

    setIsCompletionModalOpen(false);

    if (!target) {
      return;
    }

    navigate({
      pathname: target.route || "/admin/company-settings",
      search: `?section=${encodeURIComponent(target.section)}&field=${encodeURIComponent(target.fieldId || target.fieldKey || "")}`,
    });
  }, [companyData, navigate]);

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

    setSaveError("");
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

    setSaveError("");
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
    setSaveError("");

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
    setSaveError("");

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
    setSaveError("");
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

    if (!validateCompanyRequiredFields(activeTab)) {
      setIsSaving(false);
      return;
    }

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

  const companyProfileCompletion = useMemo(
    () => getCompanyProfileCompletionState(companyData),
    [companyData],
  );

  const handleOpenCompletionModal = (sectionId) => {
    setCompletionModalSectionId(
      sectionId ||
        companyProfileCompletion.firstIncompleteSection?.id ||
        companyProfileCompletion.sections[0]?.id ||
        "",
    );
    setIsCompletionModalOpen(true);
  };

  const handleCompletionSaved = (nextOrganization) => {
    setLoadedOrganization(nextOrganization);
    setCompanyData(buildCompanyDataFromProfile(loadedUser, nextOrganization));
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
              {settingsNav.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={`${item.id}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(item.id)}
                    className={`relative flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-colors lg:w-full ${
                      isActive
                        ? "bg-[#c4eba9] text-neutral-900 shadow-[inset_0_0_0_1px_rgb(6_59_0/0.14)]"
                        : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-900 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0"
                      }`}
                      aria-hidden="true"
                    />
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="p-5 sm:p-7">
            {activeTab !== "account" && (
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
            )}

            {activeTab === "account" ? (
              <CompanyOverviewDashboard
                overview={overview}
                isLoading={isLoadingOverview}
                error={overviewError}
                onRetry={loadOverview}
                companyData={companyData}
              organization={loadedOrganization}
              onNavigate={handleTabChange}
              onOpenAuthorizedPersonSection={handleOpenAuthorizedPersonSection}
              completionState={companyProfileCompletion}
              onViewAllCompletion={() => handleOpenCompletionModal(companyProfileCompletion.firstIncompleteSection?.id || companyProfileCompletion.sections[0]?.id)}
              onCompleteNow={() => handleOpenCompletionModal(companyProfileCompletion.firstIncompleteSection?.id)}
            />
            ) : activeTab === "general" ? (
              <section className="space-y-1.5 pb-5 pt-3">
                <CompanySection
                  sectionId="basic"
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
                      required
                    />
                    <Input
                      label="Legal Name"
                      name="legalName"
                      value={companyData.legalName}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Select
                      label="Business Type"
                      name="businessType"
                      placeholder="Select business type"
                      value={companyData.businessType}
                      options={businessTypeOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Select
                      label="Industry"
                      name="industry"
                      placeholder="Select industry"
                      value={companyData.industry}
                      options={industryOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Select
                      label="Status"
                      name="status"
                      placeholder="Select status"
                      value={companyData.status}
                      options={statusOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
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
                  sectionId="authorized-person"
                  number="2"
                  title="Authorized Person"
                  description="Authorized representative contact and identity."
                  isOpen={openGeneralSections.authorizedPerson}
                  onToggle={() => toggleGeneralSection("authorizedPerson")}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Owner/Director Name"
                      name="ownerDirectorName"
                      value={companyData.ownerDirectorName}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Select
                      label="Designation"
                      name="designation"
                      placeholder="Select designation"
                      value={companyData.designation}
                      options={designationOptions}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Input
                      label="Mobile Number"
                      name="mobileNumber"
                      value={companyData.mobileNumber}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <Input
                      label="Email"
                      name="adminEmail"
                      type="email"
                      value={companyData.adminEmail}
                      onChange={handleChange}
                      disabled={!isActiveSectionEditing}
                      required
                    />
                    <FileUploadField
                      label="Profile Picture"
                      name="profilePhotoUrl"
                      value={companyData.profilePhotoUrl}
                      onChange={handleFileUpload}
                      onRemove={handleRemoveFile}
                      disabled={!isActiveSectionEditing}
                      uploadLabel="Upload Photo"
                      {...getUploadFieldState("profilePhotoUrl")}
                    />
                    <FileUploadField
                      label="Digital Signature"
                      name="digitalSignatureUrl"
                      value={companyData.digitalSignatureUrl}
                      onChange={handleFileUpload}
                      onRemove={handleRemoveFile}
                      disabled={!isActiveSectionEditing}
                      uploadLabel="Upload Signature"
                      {...getUploadFieldState("digitalSignatureUrl")}
                    />
                  </div>
                </CompanySection>

                <CompanySection
                  sectionId="contact"
                  number="3"
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
                      required
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
                      required
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
                  sectionId="address"
                  number="4"
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
                      required
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
                        required
                      />
                      <Select
                        label="State"
                        name="state"
                        placeholder="Select state"
                        value={companyData.state}
                        options={stateOptions}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                        required
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
                        required
                      />
                      <Input
                        label="PIN/ZIP Code"
                        name="pincode"
                        value={companyData.pincode}
                        onChange={handleChange}
                        disabled={!isActiveSectionEditing}
                        required
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
              <section className="pb-5 pt-5" data-completion-section="branding-main">
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
              <section className="space-y-6 pb-5 pt-5" data-completion-section="billings-main">
                <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-4" data-completion-section="billings-payment">
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

                <div data-completion-section="billings-upi">
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

                <div className="border-t border-neutral-100 pt-5" data-completion-section="billings-bank-account">
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
              <section className="pb-5 pt-5" data-completion-section="online-presence-main">
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
              <section className="pb-5 pt-5" data-completion-section="business-settings-main">
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
                    required
                  />
                  <Select
                    label="Time Zone"
                    name="timeZone"
                    placeholder="Select time zone"
                    value={companyData.timeZone}
                    options={timeZoneOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                    required
                  />
                  <Select
                    label="Language"
                    name="language"
                    placeholder="Select language"
                    value={companyData.language}
                    options={languageOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                    required
                  />
                  <Select
                    label="Tax Configuration"
                    name="taxConfiguration"
                    placeholder="Select tax configuration"
                    value={companyData.taxConfiguration}
                    options={taxConfigurationOptions}
                    onChange={handleChange}
                    disabled={!isActiveSectionEditing}
                    required
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
                    required
                  />
                </div>
              </section>
            ) : activeTab === "documents" ? (
              <section className="pb-5 pt-5" data-completion-section="documents-main">
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
              <section className="pb-5 pt-5" data-completion-section="additional-info-main">
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

      <CompanyProfileCompletionModal
        isOpen={isCompletionModalOpen}
        initialSectionId={completionModalSectionId}
        companyData={companyData}
        onClose={() => setIsCompletionModalOpen(false)}
        onCompleteNow={handleCompleteProfileJump}
        onSaved={handleCompletionSaved}
      />
    </div>
  );
}
