import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-terms',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './terms.component.html',
})
export class TermsComponent implements OnInit {
    private titleService = inject(Title);
    ngOnInit() { this.titleService.setTitle('Terms of Service | Mohammad Hamza'); }
}
