/**
 * Contact Form Handler
 * Handles form submission with validation and AJAX
 */

class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitButton = this.form?.querySelector('button[type="submit"]');
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('errorMessage');

        this.init();
    }

    init() {
        if (!this.form) {
            console.error('Contact form not found');
            return;
        }

        this.bindEvents();
        this.createErrorMessageElement();
    }

    bindEvents() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Real-time validation
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    createErrorMessageElement() {
        if (!this.errorMessage) {
            this.errorMessage = document.createElement('div');
            this.errorMessage.id = 'errorMessage';
            this.errorMessage.className = 'hidden mt-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg';
            this.errorMessage.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-exclamation-circle text-red-600 dark:text-red-300 mr-2"></i>
                    <span class="error-text"></span>
                </div>
            `;
            this.form.appendChild(this.errorMessage);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);
        this.hideMessages();

        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());

            const response = await fetch('/contact/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.message);
                this.form.reset();
                this.clearAllErrors();
            } else {
                this.showError(result.message || 'An error occurred. Please try again.');

                // Show field-specific errors if available
                if (result.errors) {
                    this.showFieldErrors(result.errors);
                }
            }

        } catch (error) {
            console.error('Contact form error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm() {
        let isValid = true;
        const fields = ['name', 'email', 'subject', 'message'];

        fields.forEach(fieldName => {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name;
        let isValid = true;
        let errorMessage = '';

        // Clear previous errors
        this.clearFieldError(field);

        switch (fieldName) {
            case 'name':
                if (!value) {
                    errorMessage = 'Name is required';
                    isValid = false;
                } else if (value.length < 2) {
                    errorMessage = 'Name must be at least 2 characters';
                    isValid = false;
                } else if (value.length > 255) {
                    errorMessage = 'Name cannot exceed 255 characters';
                    isValid = false;
                }
                break;

            case 'email':
                if (!value) {
                    errorMessage = 'Email is required';
                    isValid = false;
                } else if (!this.isValidEmail(value)) {
                    errorMessage = 'Please enter a valid email address';
                    isValid = false;
                }
                break;

            case 'subject':
                if (!value) {
                    errorMessage = 'Please select a subject';
                    isValid = false;
                }
                break;

            case 'message':
                if (!value) {
                    errorMessage = 'Message is required';
                    isValid = false;
                } else if (value.length < 10) {
                    errorMessage = 'Message must be at least 10 characters';
                    isValid = false;
                } else if (value.length > 5000) {
                    errorMessage = 'Message cannot exceed 5000 characters';
                    isValid = false;
                }
                break;
        }

        if (!isValid) {
            this.showFieldError(field, errorMessage);
        }

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showFieldError(field, message) {
        field.classList.add('border-red-500', 'focus:ring-red-500');
        field.classList.remove('border-gray-300', 'focus:ring-indigo-500');

        // Create or update error message
        let errorElement = field.parentNode.querySelector('.field-error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'field-error text-red-600 dark:text-red-400 text-sm mt-1';
            field.parentNode.appendChild(errorElement);
        }
        errorElement.textContent = message;
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500', 'focus:ring-red-500');
        field.classList.add('border-gray-300', 'focus:ring-indigo-500');

        const errorElement = field.parentNode.querySelector('.field-error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    clearAllErrors() {
        const errorElements = this.form.querySelectorAll('.field-error');
        errorElements.forEach(element => element.remove());

        const fields = this.form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.classList.remove('border-red-500', 'focus:ring-red-500');
            field.classList.add('border-gray-300', 'focus:ring-indigo-500');
        });
    }

    showFieldErrors(errors) {
        Object.keys(errors).forEach(fieldName => {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                this.showFieldError(field, errors[fieldName]);
            }
        });
    }

    showSuccess(message) {
        this.successMessage.querySelector('span').textContent = message;
        this.successMessage.classList.remove('hidden');
        this.successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showError(message) {
        this.errorMessage.querySelector('.error-text').textContent = message;
        this.errorMessage.classList.remove('hidden');
        this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    hideMessages() {
        this.successMessage?.classList.add('hidden');
        this.errorMessage?.classList.add('hidden');
    }

    setLoading(loading) {
        if (loading) {
            this.submitButton.disabled = true;
            this.submitButton.innerHTML = `
                <i class="fas fa-spinner fa-spin mr-2"></i>
                Sending...
            `;
        } else {
            this.submitButton.disabled = false;
            this.submitButton.innerHTML = 'Send Message';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ContactForm();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContactForm;
}
