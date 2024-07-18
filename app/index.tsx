import { useEffect, useState } from "react";
import {
  StyleSheet, Text, View, Pressable, TouchableOpacity,
  FlatList, Button,
  NativeModules, NativeEventEmitter 
} from "react-native";
import BleManager, {
  Peripheral,
  BleConnectPeripheralEvent,
  BleDisconnectPeripheralEvent,
  
} from "react-native-ble-manager";
import { handleBtAndroidPermissions } from "@/utils/bluetooth";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(
    new Map<Peripheral['id'], Peripheral>()
  );

  const handleStopScan = () => {
    console.debug('[handleStopScan] scan completed');
    setIsScanning(false);
  }
  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    console.debug('[handleDiscoverPeripheral] new BT peripheral: ', peripheral);
    setPeripherals(peripherals => new Map(peripherals.set(peripheral.id, peripheral)));
  }
  const handleConnectPeripheral = (event: BleConnectPeripheralEvent) => {
    console.debug('[handleConnectPeripheral] peripheral connected: ', event.peripheral, event);
  }
  const handleDisconnectPeripheral = (event: BleDisconnectPeripheralEvent) => {
    console.debug('[handleDisconnecPeripheral] peripheral disconnected: ', event.peripheral, event);
  }

  useEffect(() => {
    handleBtAndroidPermissions();
    
    BleManager.start({ forceLegacy: true })
      .then(() => console.debug("BleManager Started."))
      .catch(error => console.error("BleManager could not be stated - ", error));

    const listeners = [
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
      bleManagerEmitter.addListener('BleManagerConnectPeripheral', handleConnectPeripheral),
      bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnectPeripheral),
    ];

    return () => {
      console.debug('cleaning up bt listeners...');
      for (const listener of listeners) {
        listener.remove();
      }
    }
  }, []);

  const startScan = () => {
    setIsScanning(true);
    setPeripherals(new Map());
    console.log('[startScan] scan initiated.');
    BleManager.scan([], 5, true)
      .then(() => {
        console.debug('[startScan] scan promise returned successfully.');
      })
      .catch(err => {
        console.error('[startScan] scan promise error: ', err);
      });
  }

  // TODO: fix type
  const renderDeviceItem = ({ item }: {item: any}) => (
    <View style={styles.deviceContainer}>
      <View>
        {item.name && <Text style={styles.deviceName}>{item.name}</Text>}
        <Text style={styles.deviceMac}>{item.id}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => {
        // TODO
        // connectToDevice(item.id)}
      }}>
        <Text style={styles.buttonText}>Connect</Text>
      </TouchableOpacity>
    </View>
  );

  // TODO: fix type
  const renderConnectedDeviceItem = ({ item }: {item: any}) => (
    <View style={styles.deviceContainer}>
      <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          console.log('READ DATA TODO')
          // readData(item.id, <service-uuid>, <characteristic-uuid>)
        }}
      >
        <Text style={styles.buttonText}>Read Data</Text>
      </TouchableOpacity>
    </View>
  );

  return (<View style={styles.container}>
      <Button 
        title={isScanning ? "Scanning ...": "Scan Bluetooth Devices"} 
        onPress={startScan}
        disabled={isScanning}
      />
      <Text style={styles.subtitle}>Discovered Devices:</Text>
      <FlatList
        data={[...peripherals.values()]}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />
      <Text style={styles.subtitle}>Connected Devices:</Text>
      <FlatList
        data={[]}
        renderItem={renderConnectedDeviceItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  list: {
    padding: 5,
    paddingBottom: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 5,
    minHeight: '10%'
  },
  deviceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  },
  deviceName: {
    fontSize: 16,
  },
  deviceMac: {
    color: '#666',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

