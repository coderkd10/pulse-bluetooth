import * as React from 'react';
import { render } from '@testing-library/react-native';

import { BTDataReadingModal } from '../bt_data_reading_modal';
import { BTReadingDevice } from '@/utils/types';

export const mockCurrentlyReadingDevice: BTReadingDevice = {
    device: {
        id: "62:64:0D:5F:87:9C",
        name: "JBL Flip",
    },
    readableCharacteristics: new Map([
        ["1800:2a00", {
            serviceID: "1800",
            characteristicID: "2a00",
            readingState: {
                status: "reading",
            },
        }],
        ["1800:2a01", {
            serviceID: "1800",
            characteristicID: "2a01",
            readingState: {
                status: "success",
                data: "aVBob25l",
            },
        }],
        ["89d3502b-0f36-433a-8ef4-c502ad55f8dc:c6b2f38c-23ab-46d8-a6ab-a3a870bbd5d7", {
            serviceID: "89d3502b-0f36-433a-8ef4-c502ad55f8dc",
            characteristicID: "c6b2f38c-23ab-46d8-a6ab-a3a870bbd5d7",
            readingState: {
                status: "error",
                error: "Error reading c6b2f38c-23ab-46d8-a6ab-a3a870bbd5d7 status=137",
            },
        }]
    ]),
};


it(`renders correctly`, () => {
    const tree = render(
        <BTDataReadingModal
            currentReadingDevice={mockCurrentlyReadingDevice}
            handleClose={jest.fn()}
        />
    ).toJSON();
  
    expect(tree).toMatchSnapshot();
});
