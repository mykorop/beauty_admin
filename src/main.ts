import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { configureAmplify } from './app/core/auth/auth.service';

configureAmplify();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
