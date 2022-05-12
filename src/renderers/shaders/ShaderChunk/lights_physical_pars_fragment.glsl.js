export default /* glsl */`
struct PhysicalMaterial {

	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;

	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif

	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif

	#ifdef USE_REFRACTION
		float refraction;
	#endif

};

#ifndef CLEARCOAT_R115_COMPATABILITY
// temporary
vec3 clearcoatSpecular = vec3( 0.0 );
vec3 sheenSpecular = vec3( 0.0 );
#endif

// This is a curve-fit approxmation to the "Charlie sheen" BRDF integrated over the hemisphere from 
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF". The analysis can be found
// in the Sheen section of https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness) {

	float dotNV = saturate( dot( normal, viewDir ) );

	float r2 = roughness * roughness;

	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;

	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;

	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );

	return saturate( DG * RECIPROCAL_PI );

}

// Analytical approximation of the DFG LUT, one half of the
// split-sum approximation used in indirect specular lighting.
// via 'environmentBRDF' from "Physically Based Shading on Mobile"
// https://www.unrealengine.com/blog/physically-based-shading-on-mobile
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );

	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );

	vec4 r = roughness * c0 + c1;

	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;

	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;

	return fab;

}

vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {

	vec2 fab = DFGApprox( normal, viewDir, roughness );

	return specularColor * fab.x + specularF90 * fab.y;

}

// Fdez-Agüera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
// Approximates multiscattering in order to preserve energy.
// http://www.jcgt.org/published/0008/01/03/
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {

	vec2 fab = DFGApprox( normal, viewDir, roughness );

#ifdef MULTISCATTERRING_R115_COMPATABILITY

	// This is a PBR shader snippet in three.js r115. It's fixed in https://github.com/mrdoob/three.js/pull/22308.
	// We keep it here for backward compatability.
	float dotNV = saturate( dot( normal, viewDir ) );
	float fresnel = exp2( ( -5.55473 * dotNV - 6.98316 ) * dotNV );
	vec3 Fr = max( vec3( 1.0 - roughness ), specularColor ) - specularColor;
	vec3 F = f90_r115_compatability * Fr * fresnel + specularColor;
	vec3 FssEss = F * fab.x + specularF90 * fab.y;

#else

	vec3 FssEss = specularColor * fab.x + specularF90 * fab.y;

#endif

	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;

	vec3 Favg = specularColor + ( 1.0 - specularColor ) * 0.047619; // 1/21
	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );

	singleScatter += FssEss;
	multiScatter += Fms * Ems;

}

#if NUM_RECT_AREA_LIGHTS > 0

	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 normal, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 viewDir = geometry.viewDir;
		vec3 position = geometry.position;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;

		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;

		vec2 uv = LTC_Uv( normal, viewDir, roughness );

		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );

		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);

		// LTC Fresnel Approximation by Stephen Hill
		// http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );

		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );

		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );

	}

#endif

#define DEFAULT_SPECULAR_COEFFICIENT 0.04

// Clear coat directional hemishperical reflectance (this approximation should be improved)
float clearcoatDHRApprox( const in float roughness, const in float dotNL ) {
	return DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );
}

void RE_Direct_Physical(
	const in IncidentLight directLight,
	const in vec3 normal,
#ifdef USE_CLEARCOAT
	const in vec3 ccNormal,
#endif
	const in GeometricContext geometry,
	const in PhysicalMaterial material,
	inout ReflectedLight reflectedLight
) {

	float dotNL = saturate( dot( normal, directLight.direction ) );

	vec3 irradiance = dotNL * directLight.color;

	#ifdef USE_CLEARCOAT

		float dotNLcc = saturate( dot( ccNormal, directLight.direction ) );

		vec3 ccIrradiance = dotNLcc * directLight.color;

		vec3 ccSpecular = ccIrradiance * BRDF_GGX( directLight.direction, geometry.viewDir, ccNormal, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );

	#ifdef CLEARCOAT_R115_COMPATABILITY

		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, dotNLcc );

		reflectedLight.directSpecular += material.clearcoat * ccSpecular;
	
	#else

		clearcoatSpecular += ccSpecular;

	#endif

	#else

	#ifdef CLEARCOAT_R115_COMPATABILITY

		float clearcoatDHR = 0.0;

	#endif

	#endif

	#ifdef CLEARCOAT_R115_COMPATABILITY

	float clearcoatInv = 1.0 - clearcoatDHR;

	#else

	float clearcoatInv = 1.0;

	#endif

	#ifdef USE_SHEEN

		vec3 snSpecular = irradiance * BRDF_Sheen( directLight.direction, geometry.viewDir, normal, material.sheenColor, material.sheenRoughness );

	#ifdef CLEARCOAT_R115_COMPATABILITY

		reflectedLight.directSpecular += clearcoatInv * snSpecular;

	#else

		sheenSpecular += snSpecular;

	#endif

	#endif

	reflectedLight.directSpecular += clearcoatInv * irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, normal, material.specularColor, material.specularF90, material.roughness );


	reflectedLight.directDiffuse += clearcoatInv * irradiance * BRDF_Lambert( material.diffuseColor );
}

void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectSpecular_Physical(
	const in vec3 radiance,
#ifdef USE_REFRACTION
	const in vec3 radianceRefraction,
#endif
	const in vec3 irradiance,
	const in vec3 clearcoatRadiance,
	const in vec3 normal,
#ifdef USE_CLEARCOAT
	const in vec3 ccNormal,
#endif
	const in GeometricContext geometry,
	const in PhysicalMaterial material,
	inout ReflectedLight reflectedLight
) {

	#ifdef USE_CLEARCOAT

		vec3 ccSpecular = clearcoatRadiance * EnvironmentBRDF( ccNormal, geometry.viewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );

	#ifdef CLEARCOAT_R115_COMPATABILITY

		float dotNLcc = saturate( dot( ccNormal, geometry.viewDir ) );

		float clearcoatDHR = material.clearcoat * clearcoatDHRApprox( material.clearcoatRoughness, dotNLcc );

		reflectedLight.indirectSpecular += material.clearcoat * ccSpecular;
	
	#else

		clearcoatSpecular += ccSpecular;

	#endif

	#else

	#ifdef CLEARCOAT_R115_COMPATABILITY

		float clearcoatDHR = 0.0;

	#endif

	#endif

	#ifdef USE_SHEEN

	#ifndef CLEARCOAT_R115_COMPATABILITY

		sheenSpecular += irradiance * material.sheenColor * IBLSheenBRDF( normal, geometry.viewDir, material.sheenRoughness );

	#endif

	#endif

	#ifdef CLEARCOAT_R115_COMPATABILITY

	float clearcoatInv = 1.0 - clearcoatDHR;

	#else

	float clearcoatInv = 1.0;

	#endif

	// Both indirect specular and indirect diffuse light accumulate here

	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

	computeMultiscattering( normal, geometry.viewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );

	vec3 diffuse = material.diffuseColor * ( 1.0 - ( singleScattering + multiScattering ) );

	reflectedLight.indirectSpecular += clearcoatInv * radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;

	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;

	#ifdef ENVMAP_MODE_REFLECTION

		#ifdef USE_REFRACTION

			reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, radianceRefraction * material.diffuseColor, material.refraction);

		#endif

	#endif

}

#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical

// ref: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {

	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );

}
`;
