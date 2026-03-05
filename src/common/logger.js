import { Logger, LogLevel } from '@adguard/logger';

const DEFAULT_LOG_LEVEL = IS_RELEASE ? LogLevel.Info : LogLevel.Debug;

class ExtendedLogger extends Logger {
  isVerbose() {
    return this.currentLevel === LogLevel.Debug || this.currentLevel === LogLevel.Verbose;
  }

  constructor() {
    super();

    this.currentLevel = DEFAULT_LOG_LEVEL;
  }
}

const logger = new ExtendedLogger();

export { logger };
