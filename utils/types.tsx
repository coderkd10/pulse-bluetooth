import { Peripheral, PeripheralInfo } from "react-native-ble-manager";

export type BTNotConnectedDevice = {
    peripheral: Peripheral,
    isConnecting: boolean,
};

export type BTConnectedDevice = {
    peripheral: Peripheral,
    peripheralInfo?: PeripheralInfo,
};

export type BTReadingState = {
    status: "reading", 
} | {
    status: "success",
    data: string,
} | {
    status: "error",
    error: string,
};

export type BTReadingCharacteristic = {
    serviceID: string,
    characteristicID: string,
    readingState: BTReadingState,
};

export type BTReadingDevice = {
    device: { id: string, name?: string },
    readableCharacteristics: Map<string, BTReadingCharacteristic>,
};
