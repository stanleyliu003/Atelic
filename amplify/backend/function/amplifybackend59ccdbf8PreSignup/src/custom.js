/**
 * Lambda function to automatically confirm users during pre-signup trigger
 * This function is triggered before user signup and automatically confirms the user
 */

exports.handler = async (event, context) => {
    console.log('=== PRE-SIGNUP TRIGGER STARTED ===');
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('Function name:', context.functionName);
    console.log('Function version:', context.functionVersion);

    try {
        // Check if this is a pre-signup event
        if (event.triggerSource === 'PreSignUp_AdminCreateUser' || 
            event.triggerSource === 'PreSignUp_ExternalProvider' || 
            event.triggerSource === 'PreSignUp_SignUp') {
            
            console.log('This is a pre-signup event. Processing auto-confirmation...');
            
            // Auto-confirm the user
            event.response.autoConfirmUser = true;
            
            // Auto-verify the email if it exists
            if (event.request.userAttributes.email) {
                event.response.autoVerifyEmail = true;
                console.log('Email will be auto-verified:', event.request.userAttributes.email);
            }
            
            // Auto-verify the phone number if it exists
            if (event.request.userAttributes.phone_number) {
                event.response.autoVerifyPhone = true;
                console.log('Phone will be auto-verified:', event.request.userAttributes.phone_number);
            }

            console.log('User will be auto-confirmed successfully');
            console.log('Modified event response:', JSON.stringify(event.response, null, 2));
        } else {
            console.log('This is not a pre-signup event. Trigger source:', event.triggerSource);
        }

        console.log('=== PRE-SIGNUP TRIGGER COMPLETED ===');
        return event;
    } catch (error) {
        console.error('Error in pre-signup trigger:', error);
        throw error;
    }
};
