import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-privacy',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './privacy.component.html',
})
export class PrivacyComponent implements OnInit {
    private titleService = inject(Title);
    ngOnInit() { this.titleService.setTitle('Privacy Policy | Mohammad Hamza'); }
}
