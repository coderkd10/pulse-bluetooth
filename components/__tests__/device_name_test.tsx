import * as React from 'react';
import renderer from 'react-test-renderer';

import { DeviceName } from '../device_name';

it(`renders correctly`, () => {
  const tree = renderer.create(<DeviceName id="62:64:0D:5F:87:9C" name="JBL Flip" />).toJSON();

  expect(tree).toMatchSnapshot();
});
