import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/auth.interceptor';
import { AuthService } from './app/services/auth.service';

registerLocaleData(localePt);

function initAuth(auth: AuthService) {
  return () =>
    firstValueFrom(
      auth.tryRestoreSession().pipe(
        catchError(() => {
          auth.clearLocalSession();
          return of(null);
        }),
      ),
    );
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: APP_INITIALIZER, useFactory: initAuth, deps: [AuthService], multi: true },
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
}).catch((err) => console.error(err));
