import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { FcmService } from './core/services/fcm.service';
import { PushNotificationPromptComponent } from './shared/push-notification-prompt/push-notification-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PushNotificationPromptComponent],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private theme = inject(ThemeService);
  private fcm = inject(FcmService);
  ngOnInit() {
    this.theme.init();
    this.fcm.init();
  }
}
