/*
 * Change Mail Form
 */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

import React, { useRef, useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { RiSave3Line } from 'react-icons/ri';
import { IoTrashOutline } from 'react-icons/io5';
import { t } from 'ttag';

import { cdn } from '../utils/utag.js';
import DeleteList from './DeleteList.jsx';

import {
  setBlockingDm,
  setPrivatize,
  setUserBlock,
  changeProfile,
} from '../store/actions/thunks.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import SettingsItem from './SettingsItem.jsx';
import FileUpload from './FileUpload.jsx';
import Avatar from './Avatar.jsx';

const selectBlocks = (state) => [
  state.chat.blocked,
  state.user.blockDm,
  state.user.priv,
  state.user.avatarId,
  state.user.id,
  state.user.customFlag,
  state.fetching.fetchingApi,
];

/* eslint-disable max-len */
const SocialSettings = ({ done }) => {
  const [
    blocked,
    blockDm,
    priv,
    avatarId,
    userId,
    customFlag,
    fetching,
  ] = useSelector(selectBlocks, shallowEqual);
  const [selectedCustomFlag, setSelectedCustomFlag] = useState(customFlag);
  const isDarkMode = useSelector(selectIsDarkMode);
  const uploadRef = useRef();
  const flagAtlasRef = useRef();
  const flagAtlasJsonRef = useRef();
  const dispatch = useDispatch();

  const onFlagAtlasClick = async (event) => {
    /*
     * get information of flag atlas, set ref to true while fetching those
     */
    if (flagAtlasJsonRef.current === true) {
      return;
    }
    if (!flagAtlasJsonRef.current) {
      flagAtlasJsonRef.current = true;
      try {
        const response = await fetch(cdn`/cf/atlas.json`);
        flagAtlasJsonRef.current = await response.json();
      } catch {
        flagAtlasJsonRef.current = null;
        return;
      }
    }
    const { codes, width, height, margin, columns } = flagAtlasJsonRef.current;
    const rect = flagAtlasRef.current.getBoundingClientRect();
    const xRel = Math.floor((event.clientX - rect.left) / (width + margin));
    const yRel = Math.floor((event.clientY - rect.top) / (height + margin));
    const flag = codes[yRel * columns + xRel];
    setSelectedCustomFlag(flag);
  };

  return (
    <div className="inarea">

      <div className="setitem">
        <div className="setrow">
          <h3 className="settitle">{t`Avatar`}</h3>
          <div style={{ display: 'flex', flexWrap: 'nowrap' }}>
            <Avatar uid={userId} isDarkMode={isDarkMode} avatarId={avatarId} />
            <FileUpload
              acceptedTypes="image/*"
              maxFiles={1}
              uploadRef={uploadRef}
            />
            <button
              type="button"
              onClick={async () => {
                if (!fetching) {
                  dispatch(changeProfile({ avatarId: null }));
                }
              }}
              title={t`Clear`}
              disabled={fetching}
            >
              <IoTrashOutline />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!fetching) {
                  const files = await uploadRef.current?.();
                  if (files.length) {
                    dispatch(changeProfile({ avatarId: files[0].mediaId }));
                  }
                }
              }}
              title={t`Save`}
              disabled={fetching}
            >
              <RiSave3Line />
            </button>
          </div>
        </div>
        <div className="modaldesc">{
          t`Select your Avatar. Supported Formats: jpg, gif, png, webp`
        }</div>
        <div className="modaldivider" />
      </div>


      <h3
        style={{
          textAlign: 'left',
          marginLeft: 10,
        }}
      >{t`Custom Flag`}</h3>
      <p>
        {(selectedCustomFlag) ? (
          <span key="cfs">
            {t`Selected Flag:`}
            &nbsp;
            <img
              className="chatflag illegit"
              src={cdn`/cf/${selectedCustomFlag}.gif`}
              alt={selectedCustomFlag}
            />
          </span>
        ) : (
          <span key="ncf">{t`No flag selected`}</span>
        )}
        &nbsp;
        <button
          type="button"
          onClick={() => setSelectedCustomFlag(null)}
          title={t`Clear`}
          disabled={fetching || !selectedCustomFlag}
        >
          <IoTrashOutline />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!fetching) {
              dispatch(changeProfile({ customFlag: selectedCustomFlag }));
            }
          }}
          title={t`Save`}
          disabled={fetching || customFlag === selectedCustomFlag}
        >
          <RiSave3Line />
        </button>
      </p>
      <div style={{ overflow: 'auto' }}>
        <img
          src={cdn`/cf/atlas.png`}
          alt={t`Select Flag`}
          ref={flagAtlasRef}
          onClick={onFlagAtlasClick}
          style={{ cursor: 'pointer' }}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>
      <div className="modaldivider" />

      <SettingsItem
        title={t`Block DMs`}
        value={blockDm}
        onToggle={() => {
          if (!fetching) {
            dispatch(setBlockingDm(!blockDm));
          }
        }}
      >{t`Block all Private Messages. Enabling this will delete all your current DMs. You can still start new DMs with other users, but other users won't be able to start DMs with you.`}</SettingsItem>
      <SettingsItem
        title={t`Private`}
        value={priv}
        onToggle={() => {
          if (!fetching) {
            dispatch(setPrivatize(!priv));
          }
        }}
      >{t`Don't show me in global stats`}</SettingsItem>
      <h3
        style={{
          textAlign: 'left',
          marginLeft: 10,
        }}
      >{t`Unblock Users`}</h3>
      {
        (blocked.length) ? (
          <DeleteList
            list={blocked}
            callback={(id, name) => {
              if (!fetching) {
                dispatch(setUserBlock(id, name, false));
              }
            }}
            enabled={!fetching}
          />
        )
          : <p>{t`You have no users blocked`}</p>
      }
      <div className="modaldivider" />
      <button
        type="button"
        onClick={done}
        style={{ margin: 10 }}
      >
        Done
      </button>
    </div>
  );
};

export default React.memo(SocialSettings);
