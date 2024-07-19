import { useEffect, useState } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, Alert,
  FlatList, Button,
  NativeModules, NativeEventEmitter 
} from "react-native";
import BleManager, {
  Peripheral,
  PeripheralInfo,
  BleConnectPeripheralEvent,
  BleDisconnectPeripheralEvent,
  
} from "react-native-ble-manager";
import { handleBtAndroidPermissions } from "@/utils/bluetooth";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

enum ConnectionStatus { Not_Connected, Connecting, Connected };
type BTDevice = {
  peripheral: Peripheral,
  status: ConnectionStatus,
  peripheralInfo?: PeripheralInfo,
};

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState(
    new Map<string, BTDevice>()
  );

  const handleStopScan = () => {
    console.debug('[handleStopScan] scan completed');
    setIsScanning(false);
  }
  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    console.debug('[handleDiscoverPeripheral] new BT peripheral: ', peripheral);
    setDevices(peripherals => new Map(peripherals.set(peripheral.id, { peripheral, status: ConnectionStatus.Not_Connected })));
  }
  // const handleConnectPeripheral = (event: BleConnectPeripheralEvent) => {
  //   console.debug('[handleConnectPeripheral] peripheral connected: ', event.peripheral, event);
  // }
  const handleDisconnectPeripheral = (event: BleDisconnectPeripheralEvent) => {
    console.debug('[handleDisconnecPeripheral] peripheral disconnected: ', event.peripheral, event);
    updateDeviceStatus(event.peripheral, ConnectionStatus.Not_Connected);
  }

  useEffect(() => {
    handleBtAndroidPermissions();
    
    BleManager.start({ forceLegacy: true })
      .then(() => console.debug("BleManager Started."))
      .catch(error => console.error("BleManager could not be stated - ", error));

    const listeners = [
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
      // bleManagerEmitter.addListener('BleManagerConnectPeripheral', handleConnectPeripheral),
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
    setDevices(new Map());
    console.log('[startScan] scan initiated.');
    BleManager.scan([], 3, true)
      .then(() => {
        console.debug('[startScan] scan promise returned successfully.');
      })
      .catch(err => {
        console.error('[startScan] scan promise error: ', err);
        Alert.alert("Unable to Scan Bl");
      });
  }

  const updateDevice = (deviceID: string, updaterFn: (device: BTDevice) => void) => {
    setDevices(devices => {
      const device = devices.get(deviceID);
      if (device) {
        updaterFn(device);
        return new Map(devices.set(deviceID, device));
      }
      return devices
    });
  }
  const updateDeviceStatus = (deviceID: string, status: ConnectionStatus) => {
    updateDevice(deviceID, device => {
      device.status = status;
    });
  }

  const connectToDevice = async (deviceID: string) => {
    updateDeviceStatus(deviceID, ConnectionStatus.Connecting)
    try {
      await BleManager.connect(deviceID);
      updateDeviceStatus(deviceID, ConnectionStatus.Connected);
      try {
        const peripheralInfo = await BleManager.retrieveServices(deviceID);
        console.log(
          `[connectToDevice]read peripheral info for ${deviceID}:\n`, 
          JSON.stringify(peripheralInfo, null, 2), '\n---\n\n');
        updateDevice(deviceID, device => {
          device.peripheralInfo = peripheralInfo;
        });
      } catch (err) {
        console.error('[connectToDevice] unable to retrieve services: ', err);
      }
    } catch (err) {
      console.error('[connectToDevice] unable to connect: ', err);
      Alert.alert(`Unable to connect to ${deviceID}`);
      updateDeviceStatus(deviceID, ConnectionStatus.Not_Connected);
    }
  }

  const readData = (device: BTDevice) => {
    if (!device.peripheralInfo) {
      Alert.alert(`No peripheral info found for device ${device.peripheral.id}`);
      return;
    }
    if (!device.peripheralInfo.characteristics) {
      Alert.alert(`No characteristics info found for device ${device.peripheral.id}`);
      return;
    }
    const readableCharacteristics = device.peripheralInfo.characteristics.filter(c => {
      return c.characteristic && c.service && c.properties.Read
    });
    console.log(readableCharacteristics);
    console.debug(`[readData] found ${readableCharacteristics.length} readable characteristics for ${device.peripheral.id}`);
    const l = readableCharacteristics.map(c => {
      BleManager.read(device.peripheral.id, c.service, c.characteristic)
        .then(data => {
          console.debug(`[readData] read data device:${device.peripheral.id} service:${c.service} characteristic:${c.characteristic} -`, data);
        })
        .catch(err => {
          console.error(`[readData] error reading device:${device.peripheral.id} service:${c.service} characteristic:${c.characteristic} - `, err);
        })
    });
  }

  const renderDeviceItem = ({ item: device }: { item: BTDevice }) => {
    const id = device.peripheral.id;
    const name = device.peripheral.name;
    const status = device.status;
    return (<View style={styles.deviceContainer}>
      <View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.button, status !== ConnectionStatus.Not_Connected && { backgroundColor: '#ccc' }]}
        disabled={status !== ConnectionStatus.Not_Connected}
        onPress={() => {
          connectToDevice(device.peripheral.id);
        }}
      >
        <Text style={styles.buttonText}>
          {status === ConnectionStatus.Not_Connected ? "Connect" : 
            status === ConnectionStatus.Connecting ? "Connecting" :
              "Connected"
          }
        </Text>
      </TouchableOpacity>
    </View>);
  }

  const renderConnectedDeviceItem = ({ item: device }: {item: BTDevice}) => {
    const id = device.peripheral.id;
    const name = device.peripheral.name;
    const status = device.status;
    return (<View style={styles.deviceContainer}>
       <View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>
      <TouchableOpacity
        style={[styles.button,{
          backgroundColor: 'red',
        }]}
        onPress={() => {
          readData(device);
        }}
      >
        <Text style={styles.buttonText}>Read Data</Text>
      </TouchableOpacity>
    </View>);
  }

  return (<View style={styles.container}>
      <Button 
        title={isScanning ? "Scanning ...": "Scan Bluetooth Devices"} 
        onPress={startScan}
        disabled={isScanning}
      />
      <Text style={styles.subtitle}>Discovered Devices:</Text>
      <FlatList
        data={[...devices.values()].filter(d => d.status !== ConnectionStatus.Connected)}
        renderItem={renderDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      <Text style={styles.subtitle}>Connected Devices:</Text>
      <FlatList
        data={[...devices.values()].filter(d => d.status === ConnectionStatus.Connected)}
        renderItem={renderConnectedDeviceItem}
        keyExtractor={device => device.peripheral.id}
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
  deviceID: {
    color: '#666',
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
    width: 100,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

