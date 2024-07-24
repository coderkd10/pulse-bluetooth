import * as React from 'react';
import { render } from '@testing-library/react-native';

import { HomeScreen } from '../home_screen';

const props = {
    isScanning: false,
    handleStartScan: jest.fn(),
    notConnectedDevices: [
        {
            peripheral: {
                id: "62:64:0D:5F:87:9C",
                name: "JBL Flip",
                rssi: 0,
                advertising: {},
            },
            isConnecting: false,
        },
        {
            peripheral: {
                id: "34:4F:B1:C5:3E:D9",
                name: "My BT Speaker",
                rssi: 0,
                advertising: {},
            },
            isConnecting: true,
        },
    ],
    handleConnectDevice: jest.fn(),
    connectedDevices: [
        {
            peripheral: {
                id: "75:8C:9C:43:EE:4C",
                name: "Pulse BT",
                rssi: 0,
                advertising: {},
            },
        }
    ],
    handleDisconnectDevice: jest.fn(),
    handleReadDevice: jest.fn(),
    currentReadingDevice: null,
    clearCurrentReadingDevice: jest.fn(),
};

it(`renders correctly`, () => {
    const tree = render(
        <HomeScreen {...props} />
    ).toJSON();
  
    expect(tree).toMatchSnapshot();
});
  