import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import api from '../api';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useNavigation } from '@react-navigation/native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useCallback } from 'react';
import theme from '../constants/theme';
function statusText(status:string|null){const descriptions:Record<string,string>={pending:'Funds and shares reserved; awaiting stage settlement or administrator review.',accepted:'All shares allocated; no second debit.',partial:'Some shares allocated; unused funds returned to wallet.',rejected:'Reservation returned to wallet.',carried:'Reservation retained for the next stage; awaiting stage settlement or administrator review.'};return descriptions[status||'pending']||'Contact support for this status.';}
export function DecisionHistory({id}:{id:string}){const [text,setText]=useState('');return <TouchableOpacity onPress={async()=>{try{const {data}=await api.get(`/investment-workflow/applications/${id}/history`);setText(data.history.map((h:any)=>{const d=JSON.parse(h.details);return `${new Date(h.timestamp).toLocaleString()}: ${d.Action??'Reconciliation conflict'}, stage ${d.ExpectedStep??'—'}, ${d.Reason??d.reason}`;}).join('\n')||'No decisions recorded.');}catch{setText('History unavailable. Try again.');}}}><Text style={{color:'#0070c0'}}>View decision history</Text>{!!text&&<Text>{text}</Text>}</TouchableOpacity>;}


interface InvestmentApplication {
  id: string;
  propertyTitle: string;
  propertyId: string;
  requestedAmount: number;
  requestedShares: number;
  approvedAmount?: number;
  approvedShares?: number;
  status: string | null;
  isPriority: boolean;
  stepNumber: number;
  createdAt: string;
}

export default function InvestmentApplicationScreen() {
  const [applications, setApplications] = useState<InvestmentApplication[]>([]);
  const isFocused = useIsFocused();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'InvestmentApplications'>>();
  const propertyId = route.params?.propertyId;

  const fetchApplications =  useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      const response = await api.get(`/applications/user/${user.userId}`);
      if (propertyId) {
        setApplications(response.data.filter((app: InvestmentApplication) => app.propertyId === propertyId));
      } else {
        setApplications(response.data);
      }
    //  setApplications(response.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load applications');
    }
}, [propertyId]);

  useEffect(() => {
    if (isFocused) fetchApplications();
  }, [isFocused, fetchApplications]);

  return (
    <View style={styles.container}>
      {/* <Text style={styles.title}>My Applications</Text> */}
            <Text style={styles.title}>
              {propertyId ? 'Applications for Property' : 'My Applications'}
            </Text>
      <Text>Pending and carried funds stay reserved until stage settlement or an administrator decision. Unproven reserves require reconciliation.</Text><FlatList
        data={applications}
        ListEmptyComponent={<Text>No applications for this selection.</Text>}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
      
             <TouchableOpacity onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}>
                <Text style={[styles.text, { color: '#0070c0', fontWeight: 'bold' }]}>
                  {item.propertyTitle}
                </Text>
              </TouchableOpacity>
           
            <Text style={styles.text}>Amount: ${item.requestedAmount}</Text>
            <Text style={styles.text}>Shares: {item.requestedShares}</Text>
            <Text style={styles.text}>Step: {item.stepNumber}</Text>
            <Text style={styles.text}>Status: {item.status ?? 'Pending'}</Text>
            <Text style={styles.text}>{statusText(item.status)}</Text><Text style={styles.text}>Created: {new Date(item.createdAt).toLocaleString()}</Text><DecisionHistory id={item.id}/><Text style={styles.text}>Priority: {item.isPriority ? 'Yes' : 'No'}</Text>
            {item.approvedAmount != null && (
              <Text style={styles.text}>Approved: ${item.approvedAmount} / {item.approvedShares} shares</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20,backgroundColor: theme.colors.background },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#2a1602', display: 'none'  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  text: { fontSize: 16, marginBottom: 4 },
});
