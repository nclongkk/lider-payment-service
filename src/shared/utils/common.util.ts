export const generateActiveCardOTP = (length = 4) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return OTP;
};

export const getSearchPattern = (searchKey) => {
  return { $regex: new RegExp(searchKey, 'i') };
};

export const filteredObject = (object) =>
  Object.keys(object).reduce((acc, key) => {
    if (object[key] !== undefined) {
      acc[key] = object[key];
    }
    return acc;
  }, {});
