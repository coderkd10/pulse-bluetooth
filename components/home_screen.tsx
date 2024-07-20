import { View, Text, Button, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { BTNotConnectedDevice, BTConnectedDevice, BTReadingDevice } from "@/utils/types";
import { DeviceName } from "./device_name";
import { BTDataReadingModal } from "./bt_data_reading_modal";

type HomeScreenProps = {
  isScanning: boolean,
  handleStartScan: () => void,
  notConnectedDevices: BTNotConnectedDevice[],
  handleConnectDevice: (device: BTNotConnectedDevice) => void,
  connectedDevices: BTConnectedDevice[],
  handleDisconnectDevice: (device: BTConnectedDevice) => void,
  handleReadDevice: (device: BTConnectedDevice) => void,
  currentReadingDevice: BTReadingDevice | null,
  clearCurrentReadingDevice: () => void,
};
export const HomeScreen = (props: HomeScreenProps) => {
  const renderNotConnectedDeviceItem = ({ item: device }: { item: BTNotConnectedDevice }) => {
    const id = device.peripheral.id;
    const name = device.peripheral.name;
    return (<View style={styles.deviceContainer}>
      <DeviceName id={id} name={name} />
      <TouchableOpacity 
        style={[styles.button, device.isConnecting && styles.disabledButton]}
        disabled={device.isConnecting}
        onPress={() => {
          props.handleConnectDevice(device);
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
      <DeviceName id={id} name={name} />
      <View style={styles.connectedDeviceButtonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.redBg]}
          onPress={() => {
            props.handleDisconnectDevice(device);
          }}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.greenBg,
            !device.peripheralInfo && styles.disabledButton
          ]}
          disabled={!device.peripheralInfo}
          onPress={() => {
            props.handleReadDevice(device);
          }}
        >
          <Text style={styles.buttonText}>Read Data</Text>
        </TouchableOpacity>
      </View>
    </View>);
  }

  return (
    <View style={styles.container}>
      <Button 
        title={props.isScanning ? "Scanning ...": "Scan Bluetooth Devices"} 
        onPress={() => props.handleStartScan()}
        disabled={props.isScanning}
      />
      <Text style={styles.subtitle}>Discovered Devices ({props.notConnectedDevices.length}):</Text>
      <FlatList
        data={props.notConnectedDevices}
        renderItem={renderNotConnectedDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      <Text style={styles.subtitle}>Connected Devices ({props.connectedDevices.length}):</Text>
      <FlatList
        data={props.connectedDevices}
        renderItem={renderConnectedDeviceItem}
        keyExtractor={device => device.peripheral.id}
        style={styles.list}
      />
      <BTDataReadingModal 
        currentReadingDevice={props.currentReadingDevice}
        handleClose={() => {
            props.clearCurrentReadingDevice();
        }}
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
  disabledButton: {
    backgroundColor: '#ccc',
  },
  greenBg: {
    backgroundColor: 'green',
  },
  redBg: {
    backgroundColor: 'red',
  },
  connectedDeviceButtonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
});
