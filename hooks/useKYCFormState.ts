// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useState, useRef, useEffect } from 'react';
// import { TextInput } from 'react-native';
// import { useAuth } from '@/contexts/AuthContext';
// import { useKYCData } from '@/hooks/useKYCData';
// 
// export interface KYCFormState {
//   // Personal information
//   firstName: string;
//   lastName: string;
//   middleName: string;
//   dateOfBirth: string;
//   phoneNumber: string;
//   address: string;
//   addressNo: string;
//   
//   // Identity information
//   bvn: string;
//   nin: string;
//   passportNumber: string;
//   
//   // Address details
//   lga: string;
//   state: string;
//   addressLat: string;
//   addressLon: string;
//   addressPlaceId: string;
//   
//   // Document images
//   documentFrontImage: string | null;
//   documentBackImage: string | null;
//   selfieImage: string | null;
//   houseUrl: string | null;
//   utilityBill: string | null;
//   
//   // Refs
//   lastNameInputRef: React.RefObject<TextInput | null>;
//   middleNameInputRef: React.RefObject<TextInput | null>;
//   phoneInputRef: React.RefObject<TextInput | null>;
//   addressInputRef: React.RefObject<TextInput | null>;
//   bvnInputRef: React.RefObject<TextInput | null>;
// }
// 
// export const useKYCFormState = () => {
//   const { session } = useAuth();
//   const { formData } = useKYCData();
//   
//   // Personal information
//   const [firstName, setFirstName] = useState('');
//   const [lastName, setLastName] = useState('');
//   const [middleName, setMiddleName] = useState('');
//   const [dateOfBirth, setDateOfBirth] = useState('');
//   const [phoneNumber, setPhoneNumber] = useState('');
//   const [address, setAddress] = useState('');
//   const [addressNo, setAddressNo] = useState('');
//   
//   // Identity information
//   const [bvn, setBvn] = useState('');
//   const [nin, setNin] = useState('');
//   const [passportNumber, setPassportNumber] = useState('');
//   
//   // Address details
//   const [lga, setLga] = useState('');
//   const [state, setState] = useState('');
//   const [addressLat, setAddressLat] = useState('');
//   const [addressLon, setAddressLon] = useState('');
//   const [addressPlaceId, setAddressPlaceId] = useState('');
//   
//   // Document images
//   const [documentFrontImage, setDocumentFrontImage] = useState<string | null>(null);
//   const [documentBackImage, setDocumentBackImage] = useState<string | null>(null);
//   const [selfieImage, setSelfieImage] = useState<string | null>(null);
//   const [houseUrl, setHouseUrl] = useState<string | null>(null);
//   const [utilityBill, setUtilityBill] = useState<string | null>(null);
//   
//   // Refs
//   const lastNameInputRef = useRef<TextInput>(null);
//   const middleNameInputRef = useRef<TextInput>(null);
//   const phoneInputRef = useRef<TextInput>(null);
//   const addressInputRef = useRef<TextInput>(null);
//   const bvnInputRef = useRef<TextInput>(null);
//   
//   // Pre-fill form with user data if available
//   useEffect(() => {
//     if (session?.user?.user_metadata) {
//       const { first_name, last_name, phone } = session.user.user_metadata;
//       if (first_name) setFirstName(first_name);
//       if (last_name) setLastName(last_name);
//       if (phone) setPhoneNumber(phone);
//     }
//   }, [session]);
//   
//   // Load form data when it changes
//   useEffect(() => {
//     if (formData) {
//       // Load personal information
//       if (formData.first_name) setFirstName(formData.first_name);
//       if (formData.last_name) setLastName(formData.last_name);
//       if (formData.middle_name) setMiddleName(formData.middle_name);
//       if (formData.date_of_birth) setDateOfBirth(formData.date_of_birth);
//       if (formData.phone_number) setPhoneNumber(formData.phone_number);
//       if (formData.address) setAddress(formData.address);
//       if (formData.house_url) setHouseUrl(formData.house_url);
//       if (formData.address_lat) setAddressLat(formData.address_lat);
//       if (formData.address_lon) setAddressLon(formData.address_lon);
//       if (formData.address_place_id) setAddressPlaceId(formData.address_place_id);
//       if (formData.address_no) setAddressNo(formData.address_no);
//       
//       // Load identity information
//       if (formData.bvn) setBvn(formData.bvn);
//       if (formData.nin) setNin(formData.nin);
//       
//       // Load document images
//       if (formData.document_front_url) setDocumentFrontImage(formData.document_front_url);
//       if (formData.document_back_url) setDocumentBackImage(formData.document_back_url);
//       if (formData.selfie_url) setSelfieImage(formData.selfie_url);
//       
//       // Load address details
//       if (formData.lga) setLga(formData.lga);
//       if (formData.state) setState(formData.state);
//       if (formData.utility_bill_url) setUtilityBill(formData.utility_bill_url);
//     }
//   }, [formData]);
//   
//   return {
//     // State
//     firstName,
//     lastName,
//     middleName,
//     dateOfBirth,
//     phoneNumber,
//     address,
//     addressNo,
//     bvn,
//     nin,
//     passportNumber,
//     lga,
//     state,
//     addressLat,
//     addressLon,
//     addressPlaceId,
//     documentFrontImage,
//     documentBackImage,
//     selfieImage,
//     houseUrl,
//     utilityBill,
//     
//     // Setters
//     setFirstName,
//     setLastName,
//     setMiddleName,
//     setDateOfBirth,
//     setPhoneNumber,
//     setAddress,
//     setAddressNo,
//     setBvn,
//     setNin,
//     setPassportNumber,
//     setLga,
//     setState,
//     setAddressLat,
//     setAddressLon,
//     setAddressPlaceId,
//     setDocumentFrontImage,
//     setDocumentBackImage,
//     setSelfieImage,
//     setHouseUrl,
//     setUtilityBill,
//     
//     // Refs
//     lastNameInputRef,
//     middleNameInputRef,
//     phoneInputRef,
//     addressInputRef,
//     bvnInputRef,
//   };
// };
// 
// 
