export type IdentityType = 'bvn' | 'nin' | 'passport';

export interface KYCStepProps {
  // Form data
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
  addressNo: string;
  bvn: string;
  nin: string;
  passportNumber: string;
  selectedIdentityType: IdentityType;
  documentFrontImage: string | null;
  documentBackImage: string | null;
  selfieImage: string | null;
  houseUrl: string | null;
  utilityBill: string | null;
  lga: string;
  state: string;
  
  // Form state
  errors: Record<string, string>;
  bvnVerified: boolean;
  bvnMatchedName: string;
  documentsVerified: boolean;
  isResolvingBvn: boolean;
  isVerifyingDocuments: boolean;
  
  // Callbacks
  onFirstNameChange: (text: string) => void;
  onLastNameChange: (text: string) => void;
  onMiddleNameChange: (text: string) => void;
  onDateOfBirthChange: (text: string) => void;
  onPhoneNumberChange: (text: string) => void;
  onAddressChange: (text: string) => void;
  onAddressNoChange: (text: string) => void;
  onBvnChange: (text: string) => void;
  onNinChange: (text: string) => void;
  onPassportNumberChange: (text: string) => void;
  onIdentityTypeChange: (type: IdentityType) => void;
  onDocumentFrontImageChange: (uri: string | null) => void;
  onDocumentBackImageChange: (uri: string | null) => void;
  onHouseUrlChange: (uri: string | null) => void;
  onUtilityBillChange: (uri: string | null) => void;
  onLgaChange: (text: string) => void;
  onStateChange: (text: string) => void;
  
  // Special handlers
  onDatePickerOpen: () => void;
  onLocationSearchOpen: () => void;
  onPickImage: (setImageFunction: (uri: string | null) => void, type: string) => Promise<void>;
  onTakePicture: (type: 'front' | 'back' | 'house' | 'utility') => Promise<void>;
  
  // Refs
  lastNameInputRef?: React.RefObject<TextInput | null>;
  middleNameInputRef?: React.RefObject<TextInput | null>;
  phoneInputRef?: React.RefObject<TextInput | null>;
  addressInputRef?: React.RefObject<TextInput | null>;
  bvnInputRef?: React.RefObject<TextInput | null>;
}

