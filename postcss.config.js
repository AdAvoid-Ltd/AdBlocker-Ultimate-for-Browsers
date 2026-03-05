import postcssPresetEnv from 'postcss-preset-env';
import postcssSvg from 'postcss-svg';
import postcssNested from 'postcss-nested';

export default {
  plugins: [postcssPresetEnv({ stage: 3 }), postcssSvg(), postcssNested()],
};
