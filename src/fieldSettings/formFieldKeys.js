const snakeCase = (name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
const section = (prefix, fields) => Object.fromEntries(fields.split(' ').map((name) => [name, `${prefix}.${snakeCase(name)}`]))

// Form names mapped to the canonical GET /organizations/settings/fields catalog keys.
export const FORM_FIELD_KEYS = {
  company: { gstin: 'gst_number', pincode: 'pin_code', incorporationDate: 'date_of_incorporation',
    accountHolderName: 'bank_account_holder', ifscCode: 'bank_ifsc', companyDescription: 'description',
    authorizedPersonName: 'auth_person_name', authorizedPersonDesignation: 'auth_person_designation',
    authorizedPersonMobile: 'auth_person_mobile', authorizedPersonEmail: 'auth_person_email',
    cinRegistrationNumber: 'cin_number', alternateMobileNumber: 'alternate_mobile', landlineNumber: 'landline',
    branchOfficeAddresses: 'branch_addresses', stampSealUrl: 'stamp_url', letterheadFile: 'letterhead_url', qrCodeUrl: 'payment_qr_url',
    facebook: 'facebook_url', instagram: 'instagram_url', linkedin: 'linkedin_url', xTwitter: 'twitter_url', youtube: 'youtube_url',
    whatsappBusinessNumber: 'whatsapp_number', timeZone: 'timezone', gstCertificateFile: 'doc_gst_url', panCardFile: 'doc_pan_url',
    incorporationCertificateFile: 'doc_coi_url', tradeLicenseFile: 'doc_trade_license_url', msmeCertificateFile: 'doc_msme_url',
    fssaiLicenseFile: 'doc_fssai_url', otherBusinessDocumentsFile: 'doc_other_url', ownerDirectorName: 'auth_person_name',
    designation: 'auth_person_designation', mobileNumber: 'auth_person_mobile', adminEmail: 'auth_person_email',
    profilePhotoUrl: 'auth_person_photo_url', digitalSignatureUrl: 'auth_person_signature_url', numberOfEmployees: 'employee_count', companyMissionVision: 'mission_vision' },
  customer: {
    ...section('basic_information', 'customerType customerName legalBusinessName displayName industry customerCategory customerSince'),
    profileImage: 'basic_information.profile_image_id',
    ...section('contact_information', 'primaryContactPerson designation mobileNumber alternateMobileNumber website'),
    email: 'contact_information.email_address',
    ...section('address_information', 'billingAddress shippingAddress city state country pinZipCode googleMapsLocation'),
    ...section('business_tax_information', 'panBusinessRegistrationNo taxExempt taxCategory currency'),
    gstNumber: 'business_tax_information.gstin_tax_id',
    ...section('payment_information', 'paymentTerms creditLimit openingBalance preferredPaymentMethod upiId bankName accountNumber ifscSwiftCode'),
    ...section('sales_crm_information', 'leadSource territory customerPriority preferredCommunication customerTags'),
    assignedSalesOfficerId: 'sales_crm_information.sales_representative_id',
    ...Object.fromEntries(['facebook', 'instagram', 'linkedin', 'youtube'].map((name) => [name, `social_media_online_presence.${name}_url`])),
    twitter: 'social_media_online_presence.x_twitter_url',
    ...section('additional_information', 'dateOfBirth anniversaryDate loyaltyNumber notes'),
    referralCustomer: 'additional_information.referral_customer_id',
    ...Object.fromEntries(['gstCertificate', 'panCard', 'businessRegistrationCertificate', 'addressProof', 'purchaseAgreement'].map((name) => [name, `documents.${snakeCase(name)}_id`])),
    otherDocuments: 'documents.other_document_ids',
  },
  product: {
    productCode: 'sku', category: 'category_id', subCategory: 'sub_category_id', brand: 'brand_id',
    productType: 'product_type_id', preferredSupplier: 'preferred_supplier_id', variants: 'variations', variantInventory: 'variations',
    unitOfMeasure: 'uom', videoUrl: 'product_video', catalogBrochure: 'product_catalog_brochure',
    size: 'physical_size', gstVatRate: 'tax_rate', hsnSacCode: 'hsn_code', taxInclusive: 'pricing.tax_inclusive',
    taxInclusivePrice: 'pricing.tax_inclusive', commissionPercent: 'commission',
    ...Object.fromEntries(['purchasePrice', 'sellingPrice', 'mrp', 'wholesalePrice', 'dealerPrice', 'discountPercent', 'currency'].map((name) => [name, `pricing.${snakeCase(name)}`])),
  },
  lead: { interestedProductList: 'interested_product_ids', interestedProducts: 'interested_product_ids', interestedProductIds: 'interested_product_ids' },
  supplier: { pan: 'pan_number', pinCode: 'pincode', gstRegistered: 'gst_number' },
  quotation: {},
  sales_order: { customer: 'customer_id', selectedCustomerId: 'customer_id', orderNotes: 'notes', deliveryAddress: 'delivery_address', paymentType: 'payment_type', paymentMethod: 'payment_type', deliveryType: 'fulfilment_method', deliveryMethod: 'fulfilment_method', discountValue: 'discount', discountType: 'discount' },
  purchase: {},
  expense: { paymentMode: 'payment_mode' },
}

export function formFieldKey(module, name) {
  return FORM_FIELD_KEYS[module]?.[name] || snakeCase(name)
}
