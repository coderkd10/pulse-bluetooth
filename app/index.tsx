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

enum ConnectionStatus { Not_Connected, Connecting, Connected };
type BTDevice = {
  peripheral: Peripheral,
  status: ConnectionStatus,
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
}
const getReadingDeviceCMapKey = (serviceID: string, characteristicID: string) =>
  `${serviceID}-${characteristicID}`;

export default function Index() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState(
    new Map<string, BTDevice>()
  );

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
    setDevices(peripherals => new Map(peripherals.set(peripheral.id, { peripheral, status: ConnectionStatus.Not_Connected })));
  }
  const handleDisconnectPeripheral = (event: BleDisconnectPeripheralEvent) => {
    console.debug('[handleDisconnecPeripheral] peripheral disconnected: ', event.peripheral, event);
    updateDeviceStatus(event.peripheral, ConnectionStatus.Not_Connected);
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
    setDevices(new Map());
    console.log('[startScan] scan initiated.');
    BleManager.scan([], 4, true)
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
          `[connectToDevice] read peripheral info for ${deviceID}:\n`, 
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

  const disconnectDevice = async (deviceID: string) => {
    await BleManager.disconnect(deviceID);
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
          style={[styles.button,{
            backgroundColor: 'green',
          }]}
          onPress={() => {
            readData(device);
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

  const discoveredDevices = [...devices.values()].filter(d => d.status !== ConnectionStatus.Connected);
  const connectedDevices = [...devices.values()].filter(d => d.status === ConnectionStatus.Connected);
  return (<View style={styles.container}>
      <Button 
        title={isScanning ? "Scanning ...": "Scan Bluetooth Devices"} 
        onPress={startScan}
        disabled={isScanning}
      />
      <Text style={styles.subtitle}>Discovered Devices ({discoveredDevices.length}):</Text>
      <FlatList
        data={discoveredDevices}
        renderItem={renderDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      <Text style={styles.subtitle}>Connected Devices ({connectedDevices.length}):</Text>
      <FlatList
        data={connectedDevices}
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
  return (<View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>);
}

// -- mock data
const mockCharacteristics = [
  {
    serviceID: "1800",
    characteristicID: "2a00",
    data: [105, 80, 104, 111, 110, 101],
  },
  {
    serviceID: "1800",
    characteristicID: "2a01",
    data: [64, 0],
  },
  {
    serviceID: "180a",
    characteristicID: "2a29",
    data: [65, 112, 112, 108, 101, 32, 73, 110, 99, 46],
  },
  {
    serviceID: "180a",
    characteristicID: "2a24",
    data: [105, 80, 104, 111, 110, 101, 49, 52, 44, 53],
  },
  {
    serviceID: "180f",
    characteristicID: "2a19"
  },
  {
    serviceID: "1805",
    characteristicID: "2a2b"
  },
  {
    serviceID: "89d3502b-0f36-433a-8ef4-c502ad55f8dc",
    characteristicID: "c6b2f38c-23ab-46d8-a6ab-a3a870bbd5d7"
  }
]
const delay = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}
const mockReadCharacteristics = async (serviceID: string, characteristicID: string) => {
  const waitMillis = Math.random()*10*1000;
  await delay(waitMillis);
  for (let c of mockCharacteristics) {
    if ((serviceID == c.serviceID) && (characteristicID == c.characteristicID) && c.data) {
      return c.data;
    }
  }
  throw "Error reading 00002a0f-0000-1000-8000-00805f9b34fb status=137";
}

