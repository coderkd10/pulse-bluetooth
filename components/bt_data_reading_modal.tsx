import { Modal, Text, View, FlatList, Button, StyleSheet } from "react-native";
import { BTReadingDevice, BTReadingCharacteristic } from "@/utils/types";
import { DeviceName } from "./device_name";

type BTDataReadingModalProps = {
  currentReadingDevice: BTReadingDevice | null,
  handleClose: () => void,

};
export const BTDataReadingModal = ({ currentReadingDevice, handleClose }: BTDataReadingModalProps) => {
  if (!currentReadingDevice) {
    return <></>;
  }
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={!!currentReadingDevice}
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Reading Bluetooth Data</Text>
          <View>
            <Text style={styles.deviceNameTitle}>Device</Text>
            <View style={styles.deviceNameContainer}>
              <DeviceName id={currentReadingDevice.device.id} name={currentReadingDevice.device.name}/>
            </View>
          </View>
          <Text style={{ marginBottom: 10 }}>Found {currentReadingDevice.readableCharacteristics.size} readable data elements ("characteristics").</Text>
          <FlatList
            data={[...currentReadingDevice.readableCharacteristics.values()]}
            renderItem={renderListItem}
            keyExtractor={item => `${item.serviceID}-${item.characteristicID}`}
            style={styles.list}
          />
          <Button title="Done" onPress={handleClose} />
        </View>
      </View>
    </Modal>
  );
}

const renderListItem = ({item}: { item: BTReadingCharacteristic }) => {
  return (
    <View style={styles.listItemContainer}>
      <Text>
        <Text style={{ fontWeight: 'bold' }}>ServiceID: </Text>
        {item.serviceID}
      </Text>
      <Text style={{ marginBottom: 5 }}>
        <Text style={{ fontWeight: 'bold' }}>CharacteristicID: </Text>
        {item.characteristicID}
      </Text>
      {item.readingState.status === "reading" ? 
        <Text>Reading Data ...</Text>:
        item.readingState.status === "success" ?
          <Text>Read Data: {item.readingState.data}</Text> :
          <Text>Error: {item.readingState.error}</Text>
      }
    </View>
  );
}

const styles = StyleSheet.create({
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
  deviceNameTitle: { 
    borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 4, borderTopRightRadius: 4,
    backgroundColor: '#999',
    color: '#fff',
    textAlign: 'center',
    padding: 2,
    fontWeight: 'bold',
  },
  deviceNameContainer: { 
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
  },
  list: {
    padding: 5,
    paddingBottom: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderRadius: 5,
    minHeight: '10%',
  },
  listItemContainer: {
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
  }
});
