import React from 'react';
import {View,Text} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import BlueButton from '../components/BlueButton';
export default function AddCardScreen(){
 const navigation=useNavigation<NativeStackNavigationProp<RootStackParamList>>();
 return <View style={{padding:24,gap:20}}><Text style={{fontSize:22}}>Secure payment</Text><Text>Choose an amount in Add Funds. Card details are entered only on the payment provider’s secure page. OwnersClub does not collect or store your card number, security code or verification codes.</Text><BlueButton title="Add Funds" onPress={()=>navigation.navigate('TopUp')}/></View>;
}
