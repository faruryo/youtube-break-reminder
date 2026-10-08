global.document = {
  addEventListener: jest.fn()
};

const popup = require('../popup');

function viewWithEdits() {
  const limitInputs = {};
  for (let i = 0; i <= 6; i++) {
    limitInputs[`hours_${i}`] = { value: '2' };
    limitInputs[`minutes_${i}`] = { value: '15' };
  }
  limitInputs.hours_H = { value: '3' };
  limitInputs.minutes_H = { value: '0' };
  return {
    currentText: { textContent: '' },
    remainingText: { textContent: '', style: {} },
    continuousText: { textContent: '' },
    breakIntervalInput: { value: '45' },
    resetHourInput: { value: '0' },
    debugEnabledInput: { checked: true },
    limitInputs,
    setProgress: jest.fn()
  };
}

describe('popup settings', () => {
  it('keeps a typed reset hour of 0 and treats a blank field as the default', () => {
    expect(popup.collectResetHour('0')).toBe(0);
    expect(popup.collectResetHour('')).toBe(4);
    expect(popup.collectBreakMinutes('')).toBe(30);
    expect(popup.collectBreakMinutes('0')).toBe(5);
    expect(popup.collectLimitSeconds('0', '0')).toBe(60);
    expect(popup.collectLimitSeconds('1', '30')).toBe(5400);
  });

  it('refreshes the timer without putting stored settings back into the inputs', () => {
    const view = viewWithEdits();
    popup.applyStatusView(view, {
      todaySeconds: 60,
      limitSeconds: 5400,
      breakIntervalSeconds: 30 * 60,
      continuousSeconds: 10,
      resetHour: 4,
      isDebugEnabled: false,
      limitSeconds_1: 5400
    }, false);

    expect(view.currentText.textContent).toBe('1m 0s');
    expect(view.breakIntervalInput.value).toBe('45');
    expect(view.resetHourInput.value).toBe('0');
    expect(view.limitInputs.hours_1.value).toBe('2');
    expect(view.debugEnabledInput.checked).toBe(true);
  });

  it('fills settings, including a stored reset hour of 0', () => {
    const view = viewWithEdits();
    popup.applyStatusView(view, {
      todaySeconds: 0,
      limitSeconds: 5400,
      breakIntervalSeconds: 45 * 60,
      continuousSeconds: 0,
      resetHour: 0,
      isDebugEnabled: false,
      limitSeconds_1: 2 * 3600 + 15 * 60
    }, true);

    expect(view.resetHourInput.value).toBe(0);
    expect(view.breakIntervalInput.value).toBe(45);
    expect(view.limitInputs.hours_1.value).toBe(2);
    expect(view.limitInputs.minutes_1.value).toBe(15);
    expect(view.debugEnabledInput.checked).toBe(false);
  });
});
