/**
 *
 */

import React, { Suspense, useCallback, useContext } from 'react';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import Tabs from '../Tabs.jsx';
import UserAreaContent from '../UserAreaContent.jsx';

// eslint-disable-next-line max-len
const Converter = React.lazy(() => import(/* webpackChunkName: "converter" */ '../Converter.jsx'));

const UserArea = () => {
  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);
  const {
    activeTab = t`Profile`,
  } = args;

  const setActiveTab = useCallback((label) => {
    setArgs({
      activeTab: label,
    });
    setTitle(label);
  }, [setArgs, setTitle]);

  return (
    <div style={{ textAlign: 'center' }}>
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab}>
        <div label={t`Profile`}>
          <UserAreaContent />
        </div>
        <div label={t`Converter`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Converter />
          </Suspense>
        </div>
      </Tabs>
      <br />
      {t`Consider joining us on Matrix:`}&nbsp;
      <a href="./guilded" target="_blank">{t`Invited to Chat`}</a>
      <br />
    </div>
  );
};

export default React.memo(UserArea);
