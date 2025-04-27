import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch } from 'react-native';

interface PaymentPlan {
  id: string;
  milestone: string;
  eventDate?: string;
  dueDate: string;
  installmentCode: string;
  percentage: number;
  amountDue: number;
  vat: number;
  total: number;
  paid: number;
  outstanding: number;
}

interface Props {
  plans: PaymentPlan[];
  reload: () => Promise<void>;
}

const allColumns = [
  { key: 'milestone', label: 'Milestone' },
  { key: 'eventDate', label: 'Event Date' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'installmentCode', label: 'Installment' },
  { key: 'percentage', label: 'Percentage' },
  { key: 'amountDue', label: 'Amount Due' },
  { key: 'vat', label: 'VAT' },
  { key: 'total', label: 'Total' },
  { key: 'paid', label: 'Paid' },
  { key: 'outstanding', label: 'Outstanding' },
];

const PaymentPlanTable = ({ plans }: Props) => {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(allColumns.map(c => c.key));

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(col => col !== key) : [...prev, key]
    );
  };

  const totalSum = plans.reduce((sum, p) => sum + (p.amountDue || 0) + (p.vat || 0), 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal style={styles.checkboxRow}>
        {allColumns.map(col => (
          <View key={col.key} style={styles.checkboxContainer}>
            <Switch
              value={visibleColumns.includes(col.key)}
              onValueChange={() => toggleColumn(col.key)}
            />
            <Text style={styles.checkboxLabel}>{col.label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView horizontal>
        <View>
          {/* Sticky Header */}
          <View style={styles.headerRow}>
            {allColumns.map(col =>
              visibleColumns.includes(col.key) && (
                <Text key={col.key} style={styles.headerCell}>
                  {col.label}
                </Text>
              )
            )}
          </View>

          <ScrollView style={{ maxHeight: 500 }}>
            {plans.map(plan => (
              <View key={plan.id} style={styles.row}>
                {visibleColumns.includes('milestone') && <Text style={styles.cell}>{plan.milestone}</Text>}
                {visibleColumns.includes('eventDate') && <Text style={styles.cell}>{plan.eventDate ? new Date(plan.eventDate).toLocaleDateString() : ''}</Text>}
                {visibleColumns.includes('dueDate') && <Text style={styles.cell}>{new Date(plan.dueDate).toLocaleDateString()}</Text>}
                {visibleColumns.includes('installmentCode') && <Text style={styles.cell}>{plan.installmentCode}</Text>}
                {visibleColumns.includes('percentage') && <Text style={styles.cell}>{plan.percentage}%</Text>}
                {visibleColumns.includes('amountDue') && <Text style={styles.cell}>{plan.amountDue}</Text>}
                {visibleColumns.includes('vat') && <Text style={styles.cell}>{plan.vat}</Text>}
                {visibleColumns.includes('total') && <Text style={styles.cell}>{plan.total}</Text>}
                {visibleColumns.includes('paid') && <Text style={styles.cell}>{plan.paid}</Text>}
                {visibleColumns.includes('outstanding') && <Text style={styles.cell}>{plan.outstanding}</Text>}
              </View>
            ))}
          </ScrollView>

          <View style={styles.footerRow}>
            <Text style={styles.footerCell}>Total</Text>
            <Text style={styles.footerCell}>{totalSum.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxLabel: {
    fontSize: 12,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#ddd',
    paddingVertical: 8,
  },
  headerCell: {
    fontWeight: 'bold',
    paddingHorizontal: 10,
    width: 120,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  cell: {
    paddingHorizontal: 10,
    width: 120,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    paddingVertical: 10,
    marginTop: 10,
  },
  footerCell: {
    paddingHorizontal: 10,
    width: 120,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default PaymentPlanTable;
