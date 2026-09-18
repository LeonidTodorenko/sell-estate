import { Link, useParams } from 'react-router-dom';
import { Empty, Heading, Resource, useResource } from './ui';
import { paymentPlanPath, paymentPlans } from './onboarding-contracts';
import { date, money } from './format';
export function PaymentPlanPage() {
  const {id=''}=useParams();
  const resource=useResource<unknown>(paymentPlanPath(id));
  return <><Link to={`/properties/${encodeURIComponent(id)}`}>← Property details</Link><Heading title="Payment Plan" description="Property payment schedule. Amounts belong to the property plan and are not your personal balance."/><Resource resource={resource}>{value=>{
    let rows; try { rows=paymentPlans(value); } catch(error) { return <p role="alert" className="error">{(error as Error).message}</p>; }
    return rows.length?<section className="panel table-wrap" tabIndex={0} aria-label="Payment plan, scroll horizontally for all columns"><table><thead><tr>{['Milestone','Event date','Due date','Installment code','Percentage','Amount due','VAT','Total','Paid','Outstanding'].map(t=><th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{rows.map(p=><tr key={p.id}><td>{p.milestone || '—'}</td><td>{date(p.eventDate)}</td><td>{date(p.dueDate)}</td><td>{p.installmentCode || '—'}</td><td>{p.percentage}%</td><td>{money(p.amountDue)}</td><td>{money(p.vat)}</td><td>{money(p.total)}</td><td>{money(p.paid)}</td><td>{money(p.outstanding)}</td></tr>)}</tbody></table></section>:<Empty title="No payment plan available">A schedule has not been provided for this property.</Empty>;
  }}</Resource></>;
}
