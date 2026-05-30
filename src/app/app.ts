import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { FcmService } from './core/services/fcm.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
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
