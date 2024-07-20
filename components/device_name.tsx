import { View, Text, StyleSheet } from "react-native";

export const DeviceName = ({name, id}: {name?: string, id: string}) => {
    return (
      <View>
        {name && <Text style={styles.deviceName}>{name}</Text>}
        <Text style={styles.deviceID}>{id}</Text>
      </View>
    );
}

const styles = StyleSheet.create({
    deviceName: {
      fontSize: 16,
    },
    deviceID: {
      color: '#666',
      fontWeight: 'bold',
    },
});
