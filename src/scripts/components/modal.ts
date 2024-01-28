import {setModal} from "../modalcontrol";

export abstract class BaseModal extends HTMLElement {
    protected readonly header: HTMLHeadingElement;
    private readonly inner: HTMLDivElement;
    protected readonly buttonArea: HTMLDivElement;
    protected readonly contentArea: HTMLDivElement;
   protected constructor() {
       super();
       this.classList.add('modal-dialog', 'base-modal-dialog');
       this.inner = document.createElement('div');
       this.inner.classList.add('modal-inner');
       this.header = document.createElement('h2');
       this.header.classList.add('modal-header');
       this.contentArea = document.createElement('div');
       this.contentArea.classList.add('modal-content-area');
       this.buttonArea = document.createElement('div');
       this.buttonArea.classList.add('lower-button-area', 'modal-lower-button-area');
       this.inner.appendChild(this.header);
       this.inner.appendChild(this.contentArea);
       this.inner.appendChild(this.buttonArea);
       this.appendChild(this.inner);
   }

   protected addButton(button: HTMLElement) {
       this.buttonArea.appendChild(button);
   }

   set headerText(text: string) {
       this.header.textContent = text;
   }

    show() {
        const outer = this;
        setModal({
            element: outer.inner,
            close() {
                outer.remove()
            }
        })
    }

}