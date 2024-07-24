import * as React from 'react';
import { render } from '@testing-library/react-native';

import { DeviceName } from '../device_name';

it(`renders correctly`, () => {
  const tree = render(<DeviceName id="62:64:0D:5F:87:9C" name="JBL Flip" />).toJSON();

  expect(tree).toMatchSnapshot();
});
