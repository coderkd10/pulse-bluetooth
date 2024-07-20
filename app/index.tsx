import { useEffect, useState } from "react";
import {
  StyleSheet, Text, View, TouchableOpacity, Alert,
  FlatList, Button,
  Modal,
  NativeModules, NativeEventEmitter 
} from "react-native";
import BleManager, {
  Peripheral,
  PeripheralInfo,
  BleDisconnectPeripheralEvent,
  
} from "react-native-ble-manager";
import { handleBtAndroidPermissions } from "@/utils/bluetooth";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

type BTNotConnectedDevice = {
  peripheral: Peripheral,
  isConnecting: boolean,
};

type BTConnectedDevice = {
  peripheral: Peripheral,
  peripheralInfo?: PeripheralInfo,
};

type BTReadingState = {
  status: "reading",
} | {
  status: "success",
  data: string,
} | {
  status: "error",
  error: string,
}
type BTReadingCharacteristic = {
  serviceID: string,
  characteristicID: string,
  readingState: BTReadingState,
};
type BTReadingDevice = {
  device: { id: string, name?: string },
  readableCharacteristics: Map<string, BTReadingCharacteristic>,
};
const getReadingDeviceCMapKey = (serviceID: string, characteristicID: string) =>
  `${serviceID}-${characteristicID}`;

export default function Index() {
  const [ isScanning, setIsScanning ] = useState(false);
  const [ discoveredDevices, setDiscoveredDevices ] = useState(new Map<string, Peripheral>());
  const [ connectingDevices, setConnectingDevices ] = useState(new Map<string, Peripheral>());
  const [ connectedDevices, setConnectedDevices ] = useState(new Map<string, BTConnectedDevice>());

  const addConnectingDevice = (device: Peripheral) => {
    setConnectingDevices(devices => {
      devices.set(device.id, device);
      return new Map(devices);
    });
  }
  const removeConnectingDevice = (deviceID: string) => {
    setConnectingDevices(devices => {
      devices.delete(deviceID);
      return new Map(devices);
    });
  }
  const addConnectedDevice = (device: BTConnectedDevice) => {
    setConnectedDevices(devices => {
      devices.set(device.peripheral.id, device);
      return new Map(devices);
    });
  }
  const removeConnectedDevice = (deviceID: string) => {
    setConnectedDevices(devices => {
      devices.delete(deviceID);
      return new Map(devices);
    });
  }
  const addConnectedDevicePeripheralInfo = (deviceID: string, peripheralInfo: PeripheralInfo) => {
    setConnectedDevices(devices => {
      const device = devices.get(deviceID);
      if (!device) {
        return devices;
      }
      devices.set(deviceID, { ...device, peripheralInfo });
      return new Map(devices);
    });
  }

  const getNotConnectedDevices = () => {
    const outMap = new Map<string, BTNotConnectedDevice>();
    for (let [deviceID, device] of discoveredDevices) {
      if (!connectedDevices.has(deviceID)) {
        outMap.set(deviceID, { peripheral: device, isConnecting: false });
      }
    }
    for (let [deviceID, device] of connectingDevices) {
      if (!connectedDevices.has(deviceID)) {
        outMap.set(deviceID, { peripheral: device, isConnecting: true });
      }
    }
    return [ ...outMap.values() ];
  }

  const [readingDevice, setReadingDevice] = useState<BTReadingDevice | null>(null);
  const updateCharacteristicReadingStatus = (
    deviceID: string, serviceID: string, characteristicID: string, newReadingState: BTReadingState) => {
      setReadingDevice(readingDevice => {
        if (readingDevice && readingDevice.device.id == deviceID) {
          const key = getReadingDeviceCMapKey(serviceID, characteristicID);
          const m = readingDevice.readableCharacteristics;
          const c = m.get(key);
          if (c) {
            c.readingState = newReadingState;
            readingDevice.readableCharacteristics = new Map(m.set(key, c));
          }
          return {...readingDevice};
        }
        return readingDevice;
      });
  }


  const handleStopScan = () => {
    console.debug('[handleStopScan] scan completed');
    setIsScanning(false);
  }
  const handleDiscoverPeripheral = (peripheral: Peripheral) => {
    console.debug('[handleDiscoverPeripheral] new BT peripheral: ', peripheral);
    setDiscoveredDevices(devices => new Map(devices.set(peripheral.id, peripheral)));
  }
  const handleDisconnectPeripheral = (event: BleDisconnectPeripheralEvent) => {
    console.debug('[handleDisconnecPeripheral] peripheral disconnected: ', event.peripheral, event);
    removeConnectedDevice(event.peripheral);
  }

  useEffect(() => {
    handleBtAndroidPermissions();
    
    BleManager.start()
      .then(() => console.debug("BleManager Started."))
      .catch(error => console.error("BleManager could not be stated - ", error));

    const listeners = [
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
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
    setDiscoveredDevices(new Map());

    console.log('[startScan] scan initiated.');
    BleManager.scan([], 4, true)
      .then(() => {
        console.debug('[startScan] scan promise returned successfully.');
      })
      .catch(err => {
        console.error('[startScan] scan promise error: ', err);
        Alert.alert("Unable to Scan Bluetooth");
      });
  }

  const connectToDevice = async (device: Peripheral) => {
    addConnectingDevice(device);
    try {
      await BleManager.connect(device.id);
      removeConnectingDevice(device.id);
      addConnectedDevice({ peripheral: device });
      try {
        const peripheralInfo = await BleManager.retrieveServices(device.id);
        console.log(
          `[connectToDevice] read peripheral info for ${device.id}: `, 
          JSON.stringify(peripheralInfo));
        addConnectedDevicePeripheralInfo(device.id, peripheralInfo);
      } catch (err) {
        console.error('[connectToDevice] unable to retrieve services: ', err);
      }
    } catch (err) {
      Alert.alert(`Unable to connect to ${device.id}`);
      removeConnectingDevice(device.id);
    }
  }

  const disconnectDevice = async (deviceID: string) => {
    await BleManager.disconnect(deviceID);
  }

  const readBTData = (device: BTConnectedDevice) => {
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
    console.debug(`[readData] found ${readableCharacteristics.length} readable characteristics for ${device.peripheral.id}`);
    
    // update state to reflect we're reading this device
    const cMap: Map<string, BTReadingCharacteristic> = new Map();
    for (let c of readableCharacteristics) {
      const key = getReadingDeviceCMapKey(c.service, c.characteristic);
      cMap.set(key, { serviceID: c.service, characteristicID: c.characteristic, readingState: { status: 'reading'} });
    }
    setReadingDevice({
      device: { id: device.peripheral.id, name: device.peripheral.name },
      readableCharacteristics: cMap
    });

    // start reading from BT
    for (let c of readableCharacteristics) {
      BleManager.read(device.peripheral.id, c.service, c.characteristic)
        .then(data => {
          console.debug(`[readData] read data device:${device.peripheral.id} service:${c.service} characteristic:${c.characteristic} -`, data);
          const bytes = String.fromCharCode.apply(null, data);
          const dataB64 = btoa(bytes);
          updateCharacteristicReadingStatus(
            device.peripheral.id, c.service, c.characteristic,
            {
              status: "success",
              data: dataB64,
            }
          );
        })
        .catch(err => {
          console.debug(`[readData] error reading device:${device.peripheral.id} service:${c.service} characteristic:${c.characteristic} - `, err);
          updateCharacteristicReadingStatus(
            device.peripheral.id, c.service, c.characteristic,
            {
              status: "error",
              error: err.toString(),
            }
          );
        });
    }
  }

  const renderNotConnectedDeviceItem = ({ item: device }: { item: BTNotConnectedDevice }) => {
    const id = device.peripheral.id;
    const name = device.peripheral.name;
    return (<View style={styles.deviceContainer}>
      <View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.button, device.isConnecting && { backgroundColor: '#ccc' }]}
        disabled={device.isConnecting}
        onPress={() => {
          connectToDevice(device.peripheral);
        }}
      >
        <Text style={styles.buttonText}>
          {device.isConnecting ? "Connecting" : "Connect"}
        </Text>
      </TouchableOpacity>
    </View>);
  }

  const renderConnectedDeviceItem = ({ item: device }: {item: BTConnectedDevice}) => {
    const id = device.peripheral.id;
    const name = device.peripheral.name;
    return (<View style={styles.deviceContainer}>
       <View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>
      <View style={{
        flexDirection: 'row',
        gap: 10,
      }}>
        <TouchableOpacity
          style={[styles.button,{
            backgroundColor: 'red',
          }]}
          onPress={() => {
            disconnectDevice(device.peripheral.id);
          }}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: 'green' },
            !device.peripheralInfo && { backgroundColor: '#ccc' }
          ]}
          disabled={!device.peripheralInfo}
          onPress={() => {
            readBTData(device);
          }}
        >
          <Text style={styles.buttonText}>Read Data</Text>
        </TouchableOpacity>
      </View>
    </View>);
  }

  const renderData = ({item}: { item: BTReadingCharacteristic }) => {
    return (<View style={{
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
    }}>
      <Text><Text style={{ fontWeight: 'bold' }}>ServiceID: </Text>{item.serviceID}</Text>
      <Text style={{ marginBottom: 5 }}><Text style={{ fontWeight: 'bold' }}>CharacteristicID: </Text>{item.characteristicID}</Text>
      {item.readingState.status === "reading" ? 
        <Text>Reading Data ...</Text>:
        item.readingState.status === "success" ?
          <Text>Read Data: {item.readingState.data}</Text> :
          <Text>Error: {item.readingState.error}</Text>
      }
    </View>);
  }

  const notConnectedDevicesList = getNotConnectedDevices();
  const connectedDevicesList = [...connectedDevices.values()];

  return (<View style={styles.container}>
      <Button 
        title={isScanning ? "Scanning ...": "Scan Bluetooth Devices"} 
        onPress={startScan}
        disabled={isScanning}
      />
      <Text style={styles.subtitle}>Discovered Devices ({notConnectedDevicesList.length}):</Text>
      <FlatList
        data={notConnectedDevicesList}
        renderItem={renderNotConnectedDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      <Text style={styles.subtitle}>Connected Devices ({connectedDevicesList.length}):</Text>
      <FlatList
        data={connectedDevicesList}
        renderItem={renderConnectedDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      {readingDevice && <Modal
        transparent={true}
        animationType="slide"
        visible={!!readingDevice}
        onRequestClose={() => { setReadingDevice(null); }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reading Bluetooth Data</Text>
            <View>
              <Text style={{ 
                borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                backgroundColor: '#999',
                color: '#fff',
                textAlign: 'center',
                padding: 2,
                fontWeight: 'bold',
              }}>Device</Text>
              <View style={{ 
                borderWidth: 1,
                padding: 12,
                marginBottom: 20,
              }}>
                <DeviceName id={readingDevice.device.id} name={readingDevice.device.name}/>
              </View>
            </View>
            <Text style={{ marginBottom: 10 }}>Found {readingDevice.readableCharacteristics.size} readable data elements ("characteristics").</Text>
            <FlatList
              data={[...readingDevice.readableCharacteristics.values()]}
              renderItem={renderData}
              keyExtractor={item => getReadingDeviceCMapKey(item.serviceID, item.characteristicID)}
              style={styles.list}
            />
            <Button title="Done" onPress={() => { setReadingDevice(null); }} />
          </View>
        </View>
      </Modal>}
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

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  modalContent: {
    width: '90%',
    height: '90%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    // alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCancelButton: {
    marginTop: 10,
  },
  modalCancelButtonText: {
    color: 'red',
    fontSize: 16,
  },

});


const DeviceName = ({name, id}: {name?: string, id: string}) => {
  return (
    <View>
      {name && <Text style={styles.deviceName}>{name}</Text>}
      <Text style={styles.deviceID}>{id}</Text>
    </View>
  );
}
