import { isEqual } from 'lodash-es';

export const arraysAreEqual = (arrA, arrB) => {
  return isEqual(
    arrA.sort((a, b) => a - b),
    arrB.sort((a, b) => a - b),
  );
};
