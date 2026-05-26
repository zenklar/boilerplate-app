import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ControlRow = {
  keyText: string;
  actionText: string;
};

type Props = {
  gameTitle: string;
  mobileControls: ControlRow[];
  webControls: ControlRow[];
};

const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

export default function GameControlsInfo({ gameTitle, mobileControls, webControls }: Props) {
  const [open, setOpen] = useState(false);

  const { heading, rows } = useMemo(() => {
    if (Platform.OS === 'web') {
      return { heading: 'Web Controls', rows: webControls };
    }
    return { heading: 'Mobile Controls', rows: mobileControls };
  }, [mobileControls, webControls]);

  return (
    <>
      <Pressable style={s.trigger} onPress={() => setOpen(true)}>
        <Text style={[s.triggerText, { fontFamily: MONO }]}>CONTROLS</Text>
        <View style={s.infoDot}>
          <Text style={[s.infoDotText, { fontFamily: MONO }]}>i</Text>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text style={[s.cardTitle, { fontFamily: MONO }]}>{gameTitle}</Text>
            <Text style={[s.cardSubTitle, { fontFamily: MONO }]}>{heading}</Text>

            <View style={s.rowsWrap}>
              {rows.map((row) => (
                <View key={`${row.keyText}-${row.actionText}`} style={s.row}>
                  <Text style={[s.keyText, { fontFamily: MONO }]}>{row.keyText}</Text>
                  <Text style={[s.actionText, { fontFamily: MONO }]}>{row.actionText}</Text>
                </View>
              ))}
            </View>

            <Pressable style={s.closeBtn} onPress={() => setOpen(false)}>
              <Text style={[s.closeBtnText, { fontFamily: MONO }]}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  triggerText: {
    color: '#D2D2D2',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  infoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D2D2D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoDotText: {
    color: '#D2D2D2',
    fontSize: 10,
    lineHeight: 12,
  },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 2,
    borderColor: '#B8860B',
    backgroundColor: '#070707',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  cardSubTitle: {
    color: '#FFD700',
    fontSize: 12,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  rowsWrap: {
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  row: {
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  keyText: {
    color: '#FFD700',
    fontSize: 11,
    letterSpacing: 1,
  },
  actionText: {
    color: '#DDD',
    fontSize: 11,
    lineHeight: 15,
  },
  closeBtn: {
    marginTop: 6,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#666',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#111',
  },
  closeBtnText: {
    color: '#DDD',
    fontSize: 11,
    letterSpacing: 2,
  },
});
