
import Image from 'next/image';
import dottedface from '../media/dottedface.gif';


export default function DottedFace(interactionHasStarted: boolean) {
    console.log("Interaction isnt started... Displaying dottedface image");
    if (interactionHasStarted) {
        return;
    }
    return (
        <div className="flex justify-center items-center w-512 h-512">
            <Image 
                src={dottedface} 
                alt="loading..." 
                width={512}
                height={512}
            />
        </div>
    )
}