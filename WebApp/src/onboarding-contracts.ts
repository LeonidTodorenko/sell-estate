export const authPaths = { captcha: '/captcha/generate', register: '/users/register', forgot: '/users/forgot-password', reset: '/users/reset-password' } as const;
export type Registration = { firstName:string; lastName:string; email:string; password:string; repeatPassword:string; secretWord:string; pinCode:string; referralCode:string; phoneNumber:string; captchaId:string; captchaAnswer:string; acceptTerms:boolean };
export function registrationPayload(f: Registration) {
  if (!f.acceptTerms) throw new Error('Please accept the Terms to continue.');
  if (![f.firstName,f.lastName,f.email,f.secretWord].every(v=>v.trim())) throw new Error('Please fill in all required fields.');
  passwordCheck(f.password,f.repeatPassword);
  if (f.pinCode && !/^\d{4}$/.test(f.pinCode)) throw new Error('PIN code must contain exactly 4 digits.');
  if (!f.captchaId || !/^-?\d+$/.test(f.captchaAnswer.trim()) || !Number.isSafeInteger(Number(f.captchaAnswer))) throw new Error('Please solve the CAPTCHA with a whole number.');
  return {fullName:`${f.firstName.trim()} ${f.lastName.trim()}`,email:f.email.trim(),password:f.password,secretWord:f.secretWord,pinCode:f.pinCode || undefined,referralCode:f.referralCode.trim() || undefined,phoneNumber:f.phoneNumber.trim() || undefined,captchaId:f.captchaId,captchaAnswer:Number(f.captchaAnswer)};
}
function passwordCheck(password:string,confirm:string) {
  if (password.length<8) throw new Error('Password must be at least 8 characters.');
  if (password!==confirm) throw new Error('Passwords do not match.');
}
export function resetPayload(token:string,password:string,confirm:string) {
  if (!token.trim()) throw new Error('Reset token is missing. Open the link from your email.');
  passwordCheck(password,confirm);
  return {token,newPassword:password};
}
export function forgotPayload(email:string) { if(!email.trim()) throw new Error('Please enter your email.'); return email.trim(); }
export const confirmationPath = (token:string) => `/users/confirm-email?token=${encodeURIComponent(token)}`;
export type PaymentPlan = {id:string; milestone:string; eventDate?:string|null; dueDate:string; installmentCode:string; percentage:number; amountDue:number; vat:number; total:number; paid:number; outstanding:number};
export const paymentPlanPath = (id:string) => `/properties/${encodeURIComponent(id)}/payment-plans`;
export function paymentPlans(value:unknown):PaymentPlan[] {
  if(!Array.isArray(value) || value.some(p=>!p || typeof p.id!=='string' || typeof p.milestone!=='string' || typeof p.dueDate!=='string' || typeof p.installmentCode!=='string' || ['percentage','amountDue','vat','total','paid','outstanding'].some(k=>typeof p[k]!=='number'||!Number.isFinite(p[k])))) throw new Error('The payment plan response is incomplete. Please try again later.');
  return [...value].sort((a,b)=>Date.parse(a.dueDate)-Date.parse(b.dueDate));
}
