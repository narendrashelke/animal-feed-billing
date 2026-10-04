import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface BusinessSettings {
  ownerName: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  phone: string;
  email: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit {

  ownerName = 'Narendra Shelke';
  businessName = 'Shree Ganesh PashuKhadya Kendra';
  address = 'At Post Umbare, Taluka Rahuri';
  city = 'Umbare';
  state = 'Maharashtra';
  pincode = '414105';
  gstin = '27ABCDE1234F1ZH';
  phone = '9700900933';
  email = 'ganeshfeed@gmail.com';
  bankName = 'AXIS BANK';
  accountNumber = '926020019924761';
  ifscCode = 'UTIB0002097';

  savedMessage = '';

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    const saved = localStorage.getItem('businessSettings');

    if (!saved) {
      return;
    }

    try {
      const settings: BusinessSettings = JSON.parse(saved);

      this.ownerName = settings.ownerName || '';
      this.businessName = settings.businessName || '';
      this.address = settings.address || '';
      if (this.address && this.address.startsWith('ranch Office:')) {
        this.address = 'B' + this.address;
      }
      this.city = settings.city || '';
      this.state = settings.state || 'Maharashtra';
      this.pincode = settings.pincode || '';
      this.gstin = settings.gstin || '';
      this.phone = settings.phone || '';
      this.email = settings.email || '';
      this.bankName = settings.bankName || '';
      this.accountNumber = settings.accountNumber || '';
      this.ifscCode = settings.ifscCode || '';

    } catch (error) {
      console.error('Unable to load settings:', error);
    }
  }

  saveSettings(): void {

    const settings: BusinessSettings = {
      ownerName: this.ownerName.trim(),
      businessName: this.businessName.trim(),
      address: this.address.trim(),
      city: this.city.trim(),
      state: this.state.trim(),
      pincode: this.pincode.trim(),
      gstin: this.gstin.trim().toUpperCase(),
      phone: this.phone.trim(),
      email: this.email.trim(),
      bankName: this.bankName.trim(),
      accountNumber: this.accountNumber.trim(),
      ifscCode: this.ifscCode.trim().toUpperCase()
    };

    localStorage.setItem(
      'businessSettings',
      JSON.stringify(settings)
    );

    // Update fields with cleaned values
    this.ownerName = settings.ownerName;
    this.businessName = settings.businessName;
    this.address = settings.address;
    this.city = settings.city;
    this.state = settings.state;
    this.pincode = settings.pincode;
    this.gstin = settings.gstin;
    this.phone = settings.phone;
    this.email = settings.email;
    this.bankName = settings.bankName;
    this.accountNumber = settings.accountNumber;
    this.ifscCode = settings.ifscCode;

    this.savedMessage = 'Business details saved successfully.';

    setTimeout(() => {
      this.savedMessage = '';
    }, 3000);

    console.log('Saved business settings:', settings);
  }

  clearSettings(): void {

    const confirmed = confirm(
      'Are you sure you want to clear all business details?'
    );

    if (!confirmed) {
      return;
    }

    localStorage.removeItem('businessSettings');

    this.ownerName = '';
    this.businessName = '';
    this.address = '';
    this.city = '';
    this.state = 'Maharashtra';
    this.pincode = '';
    this.gstin = '';
    this.phone = '';
    this.email = '';
    this.bankName = '';
    this.accountNumber = '';
    this.ifscCode = '';

    this.savedMessage = 'Business details cleared.';

    setTimeout(() => {
      this.savedMessage = '';
    }, 3000);
  }
}