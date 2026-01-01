import React, {  useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,  Alert, TextInput, Modal
} from 'react-native';
import api from '../api';
import { formatCurrency } from '../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
// import { Picker } from '@react-native-picker/picker';
import DropDownPicker from 'react-native-dropdown-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import PinPromptModal from '../components/PinPromptModal';
import BlueButton from '../components/BlueButton';
import theme from '../constants/theme';


interface ShareOffer {
  id: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  sharesForSale: number;
  isActive: boolean;
  expirationDate: string;
  startPricePerShare?: number;
  buyoutPricePerShare?: number | null;
}

interface ShareOfferBid {
  id: string;
  offerId: string;
  bidderId: string;
  bidPricePerShare: number;
  shares: number;
  createdAt: string;
}

const ShareMarketplaceScreen = () => {
  const [offers, setOffers] = useState<ShareOffer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<ShareOffer[]>([]);
  const [bidsMap, setBidsMap] = useState<{ [offerId: string]: ShareOfferBid[] }>({});
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [currentOffer, setCurrentOffer] = useState<ShareOffer | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [propertyTitles, setPropertyTitles] = useState<string[]>([]);
  //const [searchTitle, setSearchTitle] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const totalSharesForSelected = filteredOffers.reduce((sum, o) => sum + o.sharesForSale, 0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedOfferForExtension, setSelectedOfferForExtension] = useState<ShareOffer | null>(null);
  const [extensionDate, setExtensionDate] = useState<Date | null>(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinOrPassword, setPinOrPassword] = useState('');
const [pendingAction, setPendingAction] = useState<null | ((pin: string) => void)>(null);

  const confirmWithPin = (action: (pin: string) => void) => {
    setPendingAction(() => action);
    setPinModalVisible(true);
   // setPinOrPassword('');
  };

  const submitPin = () => {
    if (!pinOrPassword) {
      Alert.alert('Validation', 'Enter PIN or password');
      return;
    }
    setPinModalVisible(false);
 
  pendingAction?.(pinOrPassword);
  setPendingAction(null);

    // pinOrPassword не успевает провалится, потому задержка todo переделать
    // setTimeout(() => {
    //   pendingAction?.();
    //   setPendingAction(null);
    // }, 200);
  };


  const loadOffers = async () => {
    try {
      setLoading(true);
//   const res = await api.get('/share-offers/active');
      const res = await api.get<ShareOffer[]>('/share-offers/active');

      setOffers(res.data);
      setFilteredOffers(res.data);

      const titles = Array.from(new Set(res.data.map((o: ShareOffer) => o.propertyTitle)));
      setPropertyTitles(titles);

      // load all bids
      const allBids: { [offerId: string]: ShareOfferBid[] } = {};
      for (const offer of res.data) {
        try {
          const bidRes = await api.get(`/share-offers/${offer.id}/bids`);
          allBids[offer.id] = bidRes.data;
        } catch (err) {
          console.warn(`Failed to load bids for offer ${offer.id}`); // todo test
        }
      }
      setBidsMap(allBids);
    }
    catch (error: any) {
                 let message = 'Failed to load offers ';
                      console.error(error);
                      if (error.response && error.response.data) {
                        message = JSON.stringify(error.response.data);
                      } else if (error.message) {
                        message = error.message;
                      }
                      Alert.alert('Error', 'Failed to load offers ' + message);
                    console.error(message);
    }
     finally {
      setLoading(false);
    }
  };

  const loadUserId = async () => {
    const stored = await AsyncStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    if (user) setUserId(user.userId);
  };

  const loadBidsForOffer = async (offerId: string) => {
    try {
      const res = await api.get(`/share-offers/${offerId}/bids`);
      setBidsMap(prev => ({ ...prev, [offerId]: res.data }));
    } catch {
      console.warn('Failed to load bids');
    }
  };

  const openBidModal = (offer: ShareOffer) => {
    setCurrentOffer(offer);
    setBidPrice('');
    setBidModalVisible(true);
  };

  const submitBid = async (pin: string) => {
    const price = parseFloat(bidPrice);
    if (!currentOffer) return;
    const shares = currentOffer.sharesForSale;
    const minPrice = currentOffer.startPricePerShare ?? 0;

    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid price');
      return;
    }

    if (price < minPrice) {
      Alert.alert(
        'The bid is too low',
        `Minimum price per share: ${formatCurrency(minPrice)}`
      );
      return;
    }

    try {
      const stored = await AsyncStorage.getItem('user');
      const user = stored ? JSON.parse(stored) : null;
      if (!user) return;

      await api.post(`/share-offers/${currentOffer.id}/bid`, {
        bidderId: user.userId,
        bidPricePerShare: price,
        shares,
        pinOrPassword: pin,
      });

      Alert.alert('Success', 'Bid placed');
      setBidModalVisible(false);
      loadBidsForOffer(currentOffer.id);
    } catch (error: any) {
      console.error(JSON.stringify(error.response.data));
      Alert.alert('Error', 'Failed to place bid');
    }
  };

  const handleBuyNow = async (offer: ShareOffer, price: number,pin: string) => {
    Alert.alert(
      'Confirm Purchase',
      `Buy ${offer.sharesForSale} shares for ${formatCurrency(price)} per share?`,
      [
        { text: 'Cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem('user');
              const user = stored ? JSON.parse(stored) : null;
              if (!user) return;

              await api.post(`/share-offers/${offer.id}/buy`, {
                buyerId: user.userId,
                sharesToBuy: offer.sharesForSale,
                pinOrPassword: pin,
              });

              Alert.alert('Success', 'Purchase completed');
              loadOffers();
            } catch (error: any) {
              console.error(error.response?.data);
              Alert.alert('Error', 'Purchase failed');
            }
          }
        }
      ]
    );
  };

   const applySort = (type: 'max' | 'min' | 'exp') => {
    let sorted = [...filteredOffers];
    if (type === 'max') sorted.sort((a, b) => (b.startPricePerShare ?? 0) - (a.startPricePerShare ?? 0));
    if (type === 'min') sorted.sort((a, b) => (a.startPricePerShare ?? 0) - (b.startPricePerShare ?? 0));
    if (type === 'exp') sorted.sort((a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime());
    setFilteredOffers(sorted);
  };

  useEffect(() => {
    const filtered = offers.filter(o =>
      (selectedProperty === '' || o.propertyTitle === selectedProperty)
    );
    setFilteredOffers(filtered);
  }, [offers, selectedProperty]);

  // const handleAcceptBid = async (bid: ShareOfferBid) => {
  //   Alert.alert(
  //     'Accept Bid',
  //     `Sell ${bid.shares} shares for ${formatCurrency(bid.bidPricePerShare)} per share?`,
  //     [
  //       { text: 'Cancel' },
  //       {
  //         text: 'Confirm', onPress: async () => {
  //           try {
  //             await api.post(`/share-offers/bid/${bid.id}/accept?sharesToSell=${bid.shares}`);
  //             Alert.alert('Success', 'Bid accepted');
  //             loadOffers();
  //             loadBidsForOffer(bid.offerId);
  //           } catch {
  //             Alert.alert('Error', 'Failed to accept bid');
  //           }
  //         }
  //       }
  //     ]
  //   );
  // };

  // const applyFilters = useCallback(() => {
  //   const filtered = offers.filter(o =>
  //     o.propertyTitle.toLowerCase().includes(searchTitle.toLowerCase())
  //   );
  //   setFilteredOffers(filtered);
  // }, [offers, searchTitle]);

  const confirmCancelOffer = async (offerId: string) => {
    try {
      const res = await api.get('/admin/stats/settings/cancel-fee'); // вернёт число
      const fee = parseFloat(res.data);

      Alert.alert(
        'Confirm Cancellation',
        `Canceling this listing will deduct a fee of ${formatCurrency(fee)} from your balance. This fee goes to the platform. Do you want to continue?`,
        [
          { text: 'No' },
          {
            text: 'Yes',
            onPress: () => confirmWithPin((pin) => cancelOffer(offerId, pin)),
          },
        ]
      );
    }  
     catch (error: any) {
                 let message = 'Failed to load cancellation fee' ;
                      console.error(error);
                      if (error.response && error.response.data) {
                        message = JSON.stringify(error.response.data);
                      } else if (error.message) {
                        message = error.message;
                      }
                      Alert.alert('Error', 'Failed to load cancellation fee'   + message);
                    console.error(message);
              }
  };


  const cancelOffer = async (id: string, pin: string) => {
    try {
      await api.post(`/share-offers/${id}/cancel`, { pinOrPassword: pin });
      Alert.alert('Offer canceled');
      loadOffers();
    }  catch (error: any) {
                 let message = 'Failed to cancel offer ';
                      console.error(error);
                      if (error.response && error.response.data) {
                        message = JSON.stringify(error.response.data);
                      } else if (error.message) {
                        message = error.message;
                      }
                      Alert.alert('Error', 'Failed to cancel offer ' + message);
                    console.error(message);
              }
  };
 
  useEffect(() => {
    loadUserId();
    loadOffers();
  }, []);

  
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Marketplace</Text>

      <View style={styles.filterPanel}   >
        <Text style={{ marginBottom: 4 }}>Filter by property:</Text>
        {/* <Picker
          selectedValue={selectedProperty}
          onValueChange={(val) => setSelectedProperty(val)}>
          <Picker.Item label="All Properties" value="" />
          {propertyTitles.map(title => (
            <Picker.Item key={title} label={title} value={title} />
          ))}
        </Picker> */}

        <DropDownPicker
          open={dropdownOpen}
          value={selectedProperty}
          items={[  { label: 'All Properties', value: '' },  ...propertyTitles.map(title => ({ label: title, value: title }))]}
          setOpen={setDropdownOpen}
          setValue={setSelectedProperty}
          setItems={() => {}}
          placeholder="All Properties"
          searchable={true}
          containerStyle={{ marginBottom: 10, zIndex: 1000 }}
          style={{ borderColor: '#ccc' }}
          dropDownContainerStyle={{ borderColor: '#ccc' }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
          <BlueButton additionalPadding={1} width="110"  title=" Max Price" onPress={() => applySort('max')} />
          <BlueButton additionalPadding={1} width="110" title=" Min Price" onPress={() => applySort('min')} />
          <BlueButton additionalPadding={1} width="110" title="Expiring Soon" onPress={() => applySort('exp')} />
        </View>
        {selectedProperty !== '' && (
          <Text style={{ marginTop: 8, fontStyle: 'italic' }}>
          There are {totalSharesForSelected} shares listed for this property
          </Text>
        )}
      </View>
     
       <BlueButton 
          title="View Trade History"
          onPress={() => navigation.navigate('TradeHistory')}
        />
      <FlatList
        data={filteredOffers}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadOffers}
        ListEmptyComponent={<Text>No matching offers</Text>}
        renderItem={({ item }) => (
          <View style={[
              styles.card,
              !item.isActive || new Date(item.expirationDate) <= new Date() ? { borderColor: 'red' } : null
            ]}>
            <TouchableOpacity onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.propertyId })}>
              <Text style={[styles.text, { color: '#007AFF', textDecorationLine: 'underline' }]}>
                Property: {item.propertyTitle}
              </Text>
            </TouchableOpacity>
            <Text style={styles.text}>Property: {item.propertyTitle}</Text>
            <Text style={styles.text}>Start Price: {formatCurrency(item.startPricePerShare ?? 0)}</Text>
            {item.buyoutPricePerShare != null && (
              <Text style={styles.text}>Buyout Price: {formatCurrency(item.buyoutPricePerShare)}</Text>
            )}
            <Text style={styles.text}>Shares Available: {item.sharesForSale}</Text>
            <Text style={styles.text}>Expires: {new Date(item.expirationDate).toLocaleDateString()}</Text>

            {item.sellerId !== userId && (
              <>
                <BlueButton title="Place Bid" onPress={() => openBidModal(item)} />
                <View style={{ height: 10 }} />
                {/* <BlueButton title="Buy Now" onPress={() => handleBuyNow(item, item.startPricePerShare ?? 0)} /> */}
                {item.buyoutPricePerShare != null && (
                  <>
                    <View style={{ height: 10 }} />
                    <BlueButton title="Buy at Buyout Price" onPress={() => confirmWithPin((pin) => handleBuyNow(item, item.buyoutPricePerShare!,pin))} />
                  </>
                )}
              </>
            )}

            {item.sellerId === userId && (
              <>
                <View style={{ height: 10 }} />
                <BlueButton title="Cancel Listing" onPress={  () => confirmCancelOffer(item.id)} />
                <View style={{ height: 10 }} />
                 <BlueButton title="Extend until..." onPress={() => {
                    setSelectedOfferForExtension(item);
                    setExtensionDate(new Date(item.expirationDate));
                    setShowDatePicker(true);
                  }} />
                {/* <BlueButton title="Extend 7 Days" onPress={() => extendOffer(item.id, 7)} /> */}
                {/* <View style={{ height: 10 }} />
                <BlueButton title="Load Bids" onPress={() => loadBidsForOffer(item.id)} /> */}
              </>
            )}

            {bidsMap[item.id]?.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>Bids:</Text>
                {bidsMap[item.id].map((bid) => (
                  <View key={bid.id} style={{ marginTop: 4, padding: 6, borderColor: '#ddd', borderWidth: 1, borderRadius: 6 }}>
                    <Text>Price: {formatCurrency(bid.bidPricePerShare)}</Text>
                    <Text>Shares: {bid.shares}</Text>
                    <Text>At: {new Date(bid.createdAt).toLocaleString()}</Text>
                    {/* {item.sellerId === userId && (
                      <BlueButton title="Accept" onPress={() => handleAcceptBid(bid)}  />
                    )} */}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      />

      {showDatePicker && selectedOfferForExtension && (
        <DateTimePicker
          value={extensionDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (!selected || !selectedOfferForExtension) return;

            const currentExp = new Date(selectedOfferForExtension.expirationDate);
            if (selected <= currentExp) {
              Alert.alert('Invalid Date', 'New expiration date must be after current expiration.');
              return;
            }

            Alert.alert(
              'Confirm Extension',
              `Extend listing until ${selected.toLocaleDateString()}?`,
              [
                { text: 'Cancel' },
                {
                  text: 'Confirm',
                  onPress: () => confirmWithPin(async (pin) => {
                    try {
                      await api.post(`/share-offers/${selectedOfferForExtension.id}/extend-to`, {
                        newDate: selected.toISOString(),
                        pinOrPassword: pin,
                      });
                      Alert.alert('Success', 'Offer extended');
                      loadOffers();
                    }catch (error: any) {
                          let message = 'Failed to update setting';

                            if (error instanceof Error) {
                              message = error.message;
                              console.error(error.stack);   
                            } else if (error?.response?.data) {
                              message = JSON.stringify(error.response.data);
                              console.error(error.response.data);  
                            } else {
                              message = String(error);
                              console.error('Raw error:', message); 
                            }

                            Alert.alert('Error', 'Failed to update setting: ' + message);
                        } finally {
                      setSelectedOfferForExtension(null);
                    }
                  }),
                },
              ]
            );
          }}
        />
      )}

      <Modal visible={bidModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Place a Bid</Text>
            <TextInput
              style={styles.input}
              placeholder="Price per share"
              keyboardType="numeric"
              value={bidPrice}
              onChangeText={setBidPrice}
            />
            <BlueButton title="Submit" onPress={() => confirmWithPin((pin) => submitBid(pin))} />
            <View style={{ height: 10 }} />
            <BlueButton title="Cancel" onPress={() => setBidModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <PinPromptModal
        visible={pinModalVisible}
        onSubmit={submitPin}
        onCancel={() => {
          setPinModalVisible(false);
          setPinOrPassword('');
        }}
        pin={pinOrPassword}
        setPin={setPinOrPassword}
      />


    </View>
  );
};

export default ShareMarketplaceScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16,backgroundColor: theme.colors.background },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, display: 'none'  },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  text: { fontSize: 16, marginBottom: 4 },
  filterPanel: {
    marginBottom: 12,
    backgroundColor: '#f2f2f2',
    padding: 12,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});
