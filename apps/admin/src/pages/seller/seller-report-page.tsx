import { useParams } from 'react-router-dom';
import { MonthlyReportView } from '@/components/monthly-report-view';
import { useSellerPageTitle } from '@/layouts/seller-auth-card';

/** Relevé mensuel du vendeur connecté, imprimable. */
export function SellerReportPage() {
  const { month = '' } = useParams<{ month: string }>();
  useSellerPageTitle(`Relevé ${month}`);
  return <MonthlyReportView apiPath="/seller/stats/report" month={month} backHref="/vendeur/statistiques" backLabel="Statistiques" />;
}
