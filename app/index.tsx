import { useEffect, useState } from "react";
import {
  Alert, NativeModules, NativeEventEmitter 
} from "react-native";
import BleManager, {
  Peripheral,
  PeripheralInfo,
  BleDisconnectPeripheralEvent,
} from "react-native-ble-manager";

import { handleBtAndroidPermissions } from "@/utils/bluetooth";
import { 
  BTNotConnectedDevice, BTConnectedDevice, BTReadingState, BTReadingCharacteristic, BTReadingDevice 
} from "@/utils/types";
import { HomeScreen } from "@/components/home_screen";

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const getReadingDeviceCMapKey = (serviceID: string, characteristicID: string) =>
  `${serviceID}:${characteristicID}`;

export default function Index() {
  const [ isScanning, setIsScanning ] = useState(false);
  const [ discoveredDevices, setDiscoveredDevices ] = useState(new Map<string, Peripheral>());
  const [ connectingDevices, setConnectingDevices ] = useState(new Map<string, Peripheral>());
  const [ connectedDevices, setConnectedDevices ] = useState(new Map<string, BTConnectedDevice>());
  const [ currentReadingDevice, setCurrentReadingDevice ] = useState<BTReadingDevice | null>(null);

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

  const updateCharacteristicReadingState = (
    deviceID: string, serviceID: string, characteristicID: string, newReadingState: BTReadingState
  ) => {
    setCurrentReadingDevice(rDevice => {
      if (rDevice && rDevice.device.id === deviceID) {
        const key = getReadingDeviceCMapKey(serviceID, characteristicID);
        const m = rDevice.readableCharacteristics;
        const c = m.get(key);
        if (c) {
          c.readingState = newReadingState;
          rDevice.readableCharacteristics = new Map(m.set(key, c));
        }
        return {...rDevice};
      }
      return rDevice;
    });
  }

  const handleStopScanEvent = () => {
    console.debug('[handleStopScan] scan completed');
    setIsScanning(false);
  }
  const handleDiscoverPeripheralEvent = (peripheral: Peripheral) => {
    console.debug('[handleDiscoverPeripheral] new BT peripheral: ', peripheral);
    setDiscoveredDevices(devices => new Map(devices.set(peripheral.id, peripheral)));
  }
  const handleDisconnectPeripheralEvent = (event: BleDisconnectPeripheralEvent) => {
    console.debug('[handleDisconnecPeripheral] peripheral disconnected: ', event.peripheral, event);
    removeConnectedDevice(event.peripheral);
  }

  useEffect(() => {
    handleBtAndroidPermissions();
    
    BleManager.start()
      .then(() => console.debug("BleManager Started."))
      .catch(error => console.error("BleManager could not be stated - ", error));

    const listeners = [
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScanEvent),
      bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheralEvent),
      bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnectPeripheralEvent),
    ];

    return () => {
      console.debug('cleaning up bt listeners...');
      for (const listener of listeners) {
        listener.remove();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      console.log(`[connectToDevice] error connecting to ${device.id}`, err);
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
    setCurrentReadingDevice({
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
          updateCharacteristicReadingState(
            device.peripheral.id, c.service, c.characteristic,
            {
              status: "success",
              data: dataB64,
            }
          );
        })
        .catch(err => {
          console.debug(`[readData] error reading device:${device.peripheral.id} service:${c.service} characteristic:${c.characteristic} - `, err);
          updateCharacteristicReadingState(
            device.peripheral.id, c.service, c.characteristic,
            {
              status: "error",
              error: err.toString(),
            }
          );
        });
    }
  }

  return (
    <HomeScreen
      isScanning={isScanning}
      handleStartScan={startScan}
      notConnectedDevices={getNotConnectedDevices()}
      handleConnectDevice={device => connectToDevice(device.peripheral)}
      connectedDevices={[...connectedDevices.values()]}
      handleDisconnectDevice={device => disconnectDevice(device.peripheral.id)}
      handleReadDevice={device => readBTData(device)}
      currentReadingDevice={currentReadingDevice}
      clearCurrentReadingDevice={() => { setCurrentReadingDevice(null); }}
    />
  );
}
