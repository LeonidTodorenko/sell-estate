import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import api from '../api';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import theme from '../constants/theme';

interface Stats {
  investors: number;
  totalInvestments: number;
  totalProperties: number;
  totalRentalIncome: number;
  pendingWithdrawals: number;
  pendingKyc: number;
}

interface PaymentPlanStats {
  propertyTitle: string;
  month: string;
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
}

const AdminStatsScreen = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [planData, setPlanData] = useState<PaymentPlanStats[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch (err) {
        Alert.alert('Error', 'Failed to load stats');
      }
    };

    const loadPaymentStats = async () => {
      try {
        const res = await api.get('/admin/stats/payment-plan-summary');
        setPlanData(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    loadStats();
    loadPaymentStats();
  }, []);

  const screenWidth = Dimensions.get('window').width - 32;

  const grouped = planData.reduce((acc, curr) => {
    if (!acc[curr.propertyTitle]) acc[curr.propertyTitle] = [];
    acc[curr.propertyTitle].push({ month: curr.month, totalDue: curr.totalDue });
    return acc;
  }, {} as Record<string, { month: string; totalDue: number }[]>);

  const uniqueMonths = [...new Set(planData.map(p => p.month))];

  const colorPalette = ['#FF6384', '#36A2EB', '#FFCE56', '#8E44AD', '#2ECC71', '#E67E22'];

  const datasets = Object.entries(grouped).map(([propertyTitle, data], index) => {
    const color = colorPalette[index % colorPalette.length];
    const dataMap = new Map(data.map(d => [d.month, d.totalDue]));
    return {
      data: uniqueMonths.map(month => dataMap.get(month) || 0),
      color: () => color,
      strokeWidth: 2,
      legend: propertyTitle,
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      {stats && (
        <View>
          <Text>👤 Investors: {stats.investors}</Text>
          <Text>💰 Total Investments: {stats.totalInvestments} USD</Text>
          <Text>🏠 Properties: {stats.totalProperties}</Text>
          <Text>📤 Rental Income Paid: {stats.totalRentalIncome} USD</Text>
          <Text>⏳ Pending Withdrawals: {stats.pendingWithdrawals}</Text>
          <Text>📄 Pending KYC: {stats.pendingKyc}</Text>
        </View>
      )}

        {planData.length > 0 && (
          <View style={{ marginTop: 30 }}>
            <Text style={styles.chartTitle}>📆 Expected Payments by Property</Text>
            
            <LineChart
              data={{
                labels: uniqueMonths,
                datasets: datasets,
              }}
              width={screenWidth}
              height={280}
              yAxisSuffix="$"
              chartConfig={{
                backgroundColor: '#f5f5dc',
                backgroundGradientFrom: '#f5f5dc',
                backgroundGradientTo: '#f5f5dc',
                decimalPlaces: 0,
                color: () => '#2a1602',
                labelColor: () => '#2a1602',
                propsForDots: { r: '3', strokeWidth: '1' },
              }}
              bezier
            />

            <View style={styles.legendContainer}>
              {Object.keys(grouped).map((propertyTitle, index) => (
                <View key={propertyTitle} style={styles.legendItem}>
                  <View style={[styles.colorBox, { backgroundColor: colorPalette[index % colorPalette.length] }]} />
                  <Text style={styles.legendText}>{propertyTitle}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20,backgroundColor: theme.colors.background },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
    height: 15,
  },
  colorBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  
});

export default AdminStatsScreen;


// import React, { useEffect, useState } from 'react';
// import { View, Text, StyleSheet, Alert } from 'react-native';
// import api from '../api';
// import { LineChart } from 'react-native-chart-kit';
// import { Dimensions } from 'react-native';

// interface Stats {
//   investors: number;
//   totalInvestments: number;
//   totalProperties: number;
//   totalRentalIncome: number;
//   pendingWithdrawals: number;
//   pendingKyc: number;
// }

// interface PaymentPlanStats {
//   month: string;
//   totalDue: number;
//   totalPaid: number;
//   totalOutstanding: number;
// }

// const AdminStatsScreen = () => {
//   const [stats, setStats] = useState<Stats | null>(null);
//   const [planData, setPlanData] = useState<PaymentPlanStats[]>([]);

//   useEffect(() => {
//     const loadStats = async () => {
//       try {
//         const res = await api.get('/admin/stats');
//         setStats(res.data);
//       } catch (err) {
//         Alert.alert('Error', 'Failed to load stats');
//       }
//     };

//     const loadPaymentStats = async () => {
//       try {
//         const res = await api.get('/admin/stats/payment-plan-summary');
//         setPlanData(res.data);
//       } catch (err) {
//         console.error(err);
//       }
//     };

//     loadStats();
//     loadPaymentStats();
//   }, []);

//   const screenWidth = Dimensions.get('window').width - 32;

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Admin Dashboard</Text>
//       {stats && (
//         <View>
//           <Text>👤 Investors: {stats.investors}</Text>
//           <Text>💰 Total Investments: {stats.totalInvestments} USD</Text>
//           <Text>🏠 Properties: {stats.totalProperties}</Text>
//           <Text>📤 Rental Income Paid: {stats.totalRentalIncome} USD</Text>
//           <Text>⏳ Pending Withdrawals: {stats.pendingWithdrawals}</Text>
//           <Text>📄 Pending KYC: {stats.pendingKyc}</Text>
//         </View>
//       )}

//       {planData.length > 0 && (
//         <View style={{ marginTop: 30 }}>
//           <Text style={styles.chartTitle}>📆 Expected Payments (by month)</Text>
//           <LineChart
//             data={{
//               labels: planData.map(p => p.month),
//               datasets: [
//                 {
//                   data: planData.map(p => p.totalDue),
//                   strokeWidth: 2,
//                 },
//               ],
//             }}
//             width={screenWidth}
//             height={220}
//             yAxisSuffix="$"
//             chartConfig={{
//               backgroundColor: '#f5f5dc',
//               backgroundGradientFrom: '#f5f5dc',
//               backgroundGradientTo: '#f5f5dc',
//               decimalPlaces: 0,
//               color: (opacity = 1) => `rgba(0, 128, 255, ${opacity})`,
//               labelColor: () => '#2a1602',
//               propsForDots: { r: '4', strokeWidth: '2', stroke: '#2a1602' },
//             }}
//             bezier
//           />
//         </View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1, padding: 20 },
//   title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
//   chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
// });

// export default AdminStatsScreen;
