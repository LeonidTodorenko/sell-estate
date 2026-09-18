import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { confirmEmail, forgotPassword, loadCaptcha, register, resetPassword } from './api';
import { registrationPayload, type Registration } from './onboarding-contracts';

function PublicFrame({title,children}:{title:string;children:ReactNode}) {
  return <div className="public-page"><header className="public-nav"><Link className="brand" to="/">OwnersClub</Link><nav className="legal-links"><Link to="/login">Log in</Link><Link to="/register">Register</Link></nav></header><main id="main-content" className="onboarding-wrap"><h1>{title}</h1>{children}<nav className="actions"><Link to="/">Home</Link><Link to="/login">Back to Login</Link><Link to="/support">Support</Link></nav></main></div>;
}
const blank:Registration={firstName:'',lastName:'',email:'',password:'',repeatPassword:'',secretWord:'',pinCode:'',referralCode:'',phoneNumber:'',captchaId:'',captchaAnswer:'',acceptTerms:false};
export function RegisterPage() {
  const [form,setForm]=useState(blank),[captcha,setCaptcha]=useState(''),[captchaError,setCaptchaError]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[captchaBusy,setCaptchaBusy]=useState(false);
  const lock=useRef(false),generation=useRef(0); const navigate=useNavigate();
  async function reloadCaptcha() {
    const revision=++generation.current; setCaptchaBusy(true);setCaptchaError('');setCaptcha('');setForm(f=>({...f,captchaId:'',captchaAnswer:''}));
    try {const c=await loadCaptcha();if(revision!==generation.current)return;if(!c.id||!c.expression)throw new Error('CAPTCHA is unavailable.');setCaptcha(c.expression);setForm(f=>({...f,captchaId:c.id}));}
    catch(e){if(revision===generation.current)setCaptchaError((e as Error).message);}
    finally{if(revision===generation.current)setCaptchaBusy(false);}
  }
  useEffect(()=>{void reloadCaptcha();return()=>{generation.current++;};},[]);
  async function submit(e:FormEvent) {
    e.preventDefault();if(lock.current)return;setError('');
    try{registrationPayload(form);}catch(e){setError((e as Error).message);return;}
    lock.current=true;setBusy(true);
    try{await register(form);setForm(blank);navigate('/verify-email',{replace:true});}
    catch(e){setError((e as Error).message);await reloadCaptcha();}
    finally{lock.current=false;setBusy(false);}
  }
  const fields:[keyof Registration,string,string,boolean,string][]=[['firstName','First name','text',true,'given-name'],['lastName','Last name','text',true,'family-name'],['email','Email','email',true,'email'],['phoneNumber','Phone number (optional)','tel',false,'tel'],['password','Password','password',true,'new-password'],['repeatPassword','Confirm password','password',true,'new-password'],['secretWord','Secret word','password',true,'off'],['pinCode','PIN (optional, 4 digits)','password',false,'off'],['referralCode','Referral code (optional)','text',false,'off']];
  return <PublicFrame title="Create your account"><form className="panel login-form" onSubmit={submit}><p>Register a regular account. Passwords must have at least 8 characters. Keep your secret word and optional PIN safe.</p>{error&&<p role="alert" className="error">{error}</p>}<fieldset disabled={busy}>{fields.map(([key,label,type,required,autoComplete])=><label key={key}>{label}<input name={key} type={type} required={required} autoComplete={autoComplete} value={String(form[key])} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></label>)}<label className="checkbox"><input type="checkbox" required checked={form.acceptTerms} onChange={e=>setForm(f=>({...f,acceptTerms:e.target.checked}))}/>I accept the <Link to="/terms" target="_blank" rel="noopener">Terms</Link></label><p><Link to="/privacy" target="_blank" rel="noopener">Privacy policy</Link></p><label>Solve CAPTCHA: {captchaBusy?'Loading…':captcha}<input name="captchaAnswer" required inputMode="numeric" value={form.captchaAnswer} onChange={e=>setForm(f=>({...f,captchaAnswer:e.target.value}))} disabled={captchaBusy || !form.captchaId}/></label>{captchaError&&<p role="alert" className="error">{captchaError}</p>}<button type="button" disabled={captchaBusy} onClick={()=>void reloadCaptcha()}>Refresh CAPTCHA</button></fieldset><button className="button" disabled={busy||captchaBusy||!form.captchaId}>{busy?'Registering…':'Create account'}</button></form></PublicFrame>;
}
export function RecoveryPage({reset=false}:{reset?:boolean}) {
  const location=useLocation(),navigate=useNavigate();const token=new URLSearchParams(location.search).get('token') || '';
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false),[error,setError]=useState('');const lock=useRef(false);
  async function submit(e:FormEvent){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{if(reset)await resetPassword(token,password,confirm);else await forgotPassword(email);setPassword('');setConfirm('');setSuccess(true);if(reset)navigate(location.pathname,{replace:true});}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
  return <PublicFrame title={reset?'Reset password':'Forgot password'}>{success?<section className="panel" role="status"><h2>{reset?'Password updated':'Check your email'}</h2><p>{reset?'Your password has been reset. You can now log in.':'A password reset link has been sent. Open the link in your email to continue.'}</p></section>:reset&&!token?<section className="panel"><p role="alert">Reset token is missing. Open the password reset link from your email.</p><Link to="/forgot-password">Request a reset link</Link></section>:<form className="panel login-form" onSubmit={submit}>{error&&<p role="alert" className="error">{error}</p>}<fieldset disabled={busy}>{reset?<><label>New password<input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>:<label>Email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}</fieldset><button className="button" disabled={busy}>{busy?'Please wait…':reset?'Reset password':'Send reset link'}</button></form>}</PublicFrame>;
}
export function VerificationPage() {
  const location=useLocation(),navigate=useNavigate();const token=new URLSearchParams(location.search).get('token') || '';
  const [busy,setBusy]=useState(false),[success,setSuccess]=useState(false),[error,setError]=useState('');const lock=useRef(false);
  async function verify(){if(!token||lock.current)return;lock.current=true;setBusy(true);setError('');try{await confirmEmail(token);setSuccess(true);navigate(location.pathname,{replace:true});}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}}
  return <PublicFrame title="Email verification"><section className="panel">{success?<p role="status">Email confirmed. You can now log in.</p>:token?<><p>Confirm your email address to complete registration.</p><button className="button" disabled={busy} onClick={()=>void verify()}>{busy?'Confirming…':'Confirm email'}</button></>:<p>Check your inbox and spam folder for the registration email. Open its confirmation link, then return to Login. If the message has not arrived, contact support.</p>}{error&&<p className="error" role="alert">{error}</p>}</section></PublicFrame>;
}
